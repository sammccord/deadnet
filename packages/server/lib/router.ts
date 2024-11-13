import { Message } from '@deadnet/bebop';
import {
  type BebopContentType,
  Deadline,
  Metadata,
  MethodType,
  TempoError,
  type TempoLogger,
  TempoStatusCode,
  TempoUtil,
  stringifyCredential
} from '@tempojs/common';
import {
  type AuthInterceptor,
  BaseRouter,
  type BebopMethodAny,
  type IncomingContext,
  ServerContext,
  type ServiceRegistry,
  TempoRouterConfiguration,
} from '@tempojs/server';
import type { BebopRecord } from 'bebop';
import type { ServerWebSocket } from 'bun';
import EventEmitter from 'node:events';
import type { IMessage } from './../../bebop/lib/index';

export class TempoWsRouter<TEnv> extends BaseRouter<string | Buffer, ServerWebSocket<TEnv>, Message> {
  constructor(
    logger: TempoLogger,
    registry: ServiceRegistry,
    configuration: TempoRouterConfiguration = new TempoRouterConfiguration(),
    authInterceptor?: AuthInterceptor,
  ) {
    super(logger, registry, configuration, authInterceptor);
  }

  private async setAuthContext(request: Message
    , context: ServerContext): Promise<void> {
    const authHeader = request.authorization;
    if (authHeader !== undefined && this.authInterceptor !== undefined) {
      const authContext = await this.authInterceptor.intercept(context, authHeader);
      if (authContext !== undefined) context.authContext = authContext;
    }
  }

  private async invokeUnaryMethod(
    request: Message,
    context: ServerContext,
    method: BebopMethodAny,
    contentType: BebopContentType,
  ): Promise<BebopRecord> {
    await this.setAuthContext(request, context);
    if (this.hooks !== undefined) {
      await this.hooks.executeRequestHooks(context);
    }
    const requestData = request.data!
    const record = this.deserializeRequest(requestData, method, contentType);
    if (this.hooks !== undefined) {
      await this.hooks.executeDecodeHooks(context, record);
    }
    return await method.invoke(record, context);
  }

  private clientStreams: Map<number, EventEmitter> = new Map()

  private async invokeClientStreamMethod(
    request: Message,
    context: ServerContext,
    method: BebopMethodAny,
    contentType: BebopContentType,
  ): Promise<BebopRecord> {
    await this.setAuthContext(request, context);
    if (this.hooks !== undefined) {
      await this.hooks.executeRequestHooks(context);
    }
    let eventEmitter = this.clientStreams.get(request.methodId!)
    if (!eventEmitter) {
      eventEmitter = new EventEmitter()
      this.clientStreams.set(request.methodId!, eventEmitter)
    }
    const hooks = this.hooks
    const deserializeRequest = this.deserializeRequest
    const generator = () => {
      return async function* generate() {
        let results: TRecord[] = [];
        let resolve: () => void;
        let promise = new Promise(r => resolve = r);
        let done = false;

        eventEmitter.on('msg', async (request: Message) => {
          if (hooks !== undefined) {
            await hooks.executeRequestHooks(context);
          }
          const requestData = request.data!
          const record = deserializeRequest(requestData, method, contentType);
          if (hooks !== undefined) {
            await hooks.executeDecodeHooks(context, record);
          }
          resolve(record);
          promise = new Promise(r => resolve = r);
        })

        while (!done) {
          await promise;
          yield await promise;
          results = [];
        }
      }
    };


    return await method.invoke(generator, context);
  }

  private async invokeServerStreamMethod(
    request: Message,
    context: ServerContext,
    method: BebopMethodAny,
    contentType: BebopContentType,
  ): Promise<AsyncGenerator<BebopRecord, void, unknown>> {
    await this.setAuthContext(request, context);
    if (this.hooks !== undefined) {
      await this.hooks.executeRequestHooks(context);
    }
    const requestData = new Uint8Array(
      await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        request.on('data', (chunk: Buffer) => chunks.push(chunk));
        request.on('end', () => resolve(Buffer.concat(chunks)));
        request.on('error', (err) => reject(err));
      }),
    );
    if (requestData.length > this.maxReceiveMessageSize) {
      throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
    }
    const record = this.deserializeRequest(requestData, method, contentType);
    if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
      throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: method must be async generator');
    }
    if (this.hooks !== undefined) {
      await this.hooks.executeDecodeHooks(context, record);
    }
    return method.invoke(record, context);
  }

  private async invokeDuplexStreamMethod(
    request: Message,
    context: ServerContext,
    method: BebopMethodAny,
    contentType: BebopContentType,
  ): Promise<AsyncGenerator<BebopRecord, void, unknown>> {
    await this.setAuthContext(request, context);
    if (this.hooks !== undefined) {
      await this.hooks.executeRequestHooks(context);
    }
    const generator = () => {
      return readTempoStream(
        request,
        async (data: Uint8Array) => {
          if (data.length > this.maxReceiveMessageSize) {
            throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'request too large');
          }
          const record = this.deserializeRequest(data, method, contentType);
          if (this.hooks !== undefined) {
            await this.hooks.executeDecodeHooks(context, record);
          }
          return record;
        },
        context.clientDeadline,
      );
    };
    if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
      throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: method must be async generator');
    }
    return method.invoke(generator, context);
  }

  private makeCustomMetaData(_metadata: Map<string, string[]>): Metadata {
    const metadata = new Metadata();
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (metadata as any).data = _metadata
    return metadata
  }

  public override async process(req: string | Buffer, response: Message, env: ServerWebSocket<TEnv>) {
    let request: Message
    let contentType: 'json' | 'bebop'
    if (typeof req === 'string') {
      try {
        contentType = 'json'
        request = new Message(JSON.parse(req) as IMessage)
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } catch (e: any) {
        throw new TempoError(
          TempoStatusCode.UNKNOWN_CONTENT_TYPE,
          e.message,
        );
      }

    } else {
      contentType = 'bebop'
      request = new Message(Message.decode(req as unknown as Uint8Array))
    }
    try {
      const methodId = Number(request.methodId!);
      const method = this.registry.getMethod(methodId);
      if (!method) {
        throw new TempoError(
          TempoStatusCode.NOT_FOUND,
          `no service is registered which contains a method of '${methodId}'`,
        );
      }
      const metadataHeader = request.customMetadata;
      const metadata =
        metadataHeader ? this.makeCustomMetaData(metadataHeader) : new Metadata();

      const previousAttempts = request.customMetadata?.get('tempo-previous-rpc-attempts');
      if (previousAttempts !== undefined) {
        const numberOfAttempts = previousAttempts.at(0);
        if (numberOfAttempts && Number(numberOfAttempts) > this.maxRetryAttempts) {
          throw new TempoError(TempoStatusCode.RESOURCE_EXHAUSTED, 'max retry attempts exceeded');
        }
      }

      let deadline: Deadline | undefined;
      const deadlineHeader = request.deadline;
      if (deadlineHeader !== undefined) {
        deadline = new Deadline(deadlineHeader)
      }
      if (deadline !== undefined && deadline.isExpired()) {
        throw new TempoError(TempoStatusCode.DEADLINE_EXCEEDED, 'incoming request has already exceeded its deadline');
      }
      const outgoingMetadata = new Metadata();
      const incomingContext: IncomingContext = {
        headers: new Headers(),
        metadata: metadata,
      };
      if (deadline !== undefined) {
        incomingContext.deadline = deadline;
      }
      const context = new ServerContext(
        incomingContext,
        {
          metadata: outgoingMetadata,
        },
        env,
      );
      const handleRequest = async () => {
        let recordGenerator: AsyncGenerator<BebopRecord, void, undefined> | undefined = undefined;
        let record: BebopRecord | undefined;
        switch (method.type) {
          case MethodType.Unary:
            record = await this.invokeUnaryMethod(request, context, method, contentType);
            break;
          case MethodType.ClientStream:
            record = await this.invokeClientStreamMethod(request, context, method, contentType);
            break;
          case MethodType.ServerStream:
            recordGenerator = await this.invokeServerStreamMethod(request, context, method, contentType);
            break;
          case MethodType.DuplexStream:
            recordGenerator = await this.invokeDuplexStreamMethod(request, context, method, contentType);
            break;
          default:
            throw new TempoError(TempoStatusCode.INTERNAL, 'service method incorrect: unknown method type');
        }

        const outgoingCredential = context.outgoingCredential;
        if (outgoingCredential) {
          response.credential = stringifyCredential(outgoingCredential)
        }
        response.methodId = request.methodId
        response.messageId = request.messageId
        response.status = TempoStatusCode.OK
        response.msg = 'OK'
        if (this.hooks !== undefined) {
          await this.hooks.executeResponseHooks(context);
        }
        outgoingMetadata.freeze();
        if (outgoingMetadata.size() > 0) {
          //@ts-expect-error
          response.customMetadata = outgoingMetadata.data
        }
        if (recordGenerator !== undefined) {
          const writeFrames = async () => {
            for await (const value of recordGenerator) {
              const responseData = this.serializeResponse(value, method, contentType);
              response.data = responseData
              env.send(this.serializeResponse(response, method, contentType), true)
            }
          };

          if (deadline) {
            await deadline.executeWithinDeadline(writeFrames);
          } else {
            await writeFrames();
          }
        } else {
          if (record === undefined) {
            throw new TempoError(TempoStatusCode.INTERNAL, 'service method did not return a record');
          }
          const responseData = this.serializeResponse(record, method, contentType);
          response.data = responseData
          env.send(this.serializeResponse(response, method, contentType), true)
        }
      };
      deadline !== undefined ? await deadline.executeWithinDeadline(handleRequest) : await handleRequest();
    } catch (e) {
      let status = TempoStatusCode.UNKNOWN;
      let message = 'unknown error';
      if (e instanceof TempoError) {
        status = e.status;
        message = e.message;
        // dont expose internal error messages to the client
        if (e.status === TempoStatusCode.INTERNAL && this.transmitInternalErrors !== true) {
          message = 'internal error';
        }
        // internal errors indicate transient problems or implementation bugs
        // so we log them as critical errors
        e.status === TempoStatusCode.INTERNAL
          ? this.logger.critical(e.message, undefined, e)
          : this.logger.error(message, undefined, e);
      } else if (e instanceof Error) {
        message = e.message;
        this.logger.error(message, undefined, e);
      }
      if (e instanceof Error && this.hooks !== undefined) {
        await this.hooks.executeErrorHooks(undefined, e);
      }
      response.status = status
      response.msg = message
    }
  }

  override handle(_request: string | Buffer, _env: ServerWebSocket<TEnv>): Promise<Message> {
    throw new TempoError(TempoStatusCode.UNIMPLEMENTED, 'Method not implemented.');
  }
}
