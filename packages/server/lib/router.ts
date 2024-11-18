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
  stringifyCredential,
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
import type { IMessage } from './../../bebop/lib/index';
import { createEventIterator } from './createEventIterator';

export class TempoWsRouter<TEnv> extends BaseRouter<
  string | Buffer,
  ServerWebSocket<TEnv>,
  Message
> {
  private readonly events = new EventTarget()
  private readonly clientStreams: Map<
    string,
    Promise<any>
  > = new Map();

  constructor(
    logger: TempoLogger,
    registry: ServiceRegistry,
    configuration: TempoRouterConfiguration = new TempoRouterConfiguration(),
    authInterceptor?: AuthInterceptor,
  ) {
    super(logger, registry, configuration, authInterceptor);
  }

  private async setAuthContext(
    request: Message,
    context: ServerContext,
  ): Promise<void> {
    const authHeader = request.authorization;
    if (authHeader !== undefined && this.authInterceptor !== undefined) {
      const authContext = await this.authInterceptor.intercept(
        context,
        authHeader,
      );
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
    const requestData = request.data!;
    const record = this.deserializeRequest(requestData, method, contentType);
    if (this.hooks !== undefined) {
      await this.hooks.executeDecodeHooks(context, record);
    }
    return await method.invoke(record, context);
  }

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
    const messageId = request.messageId!.toString()
    const isStreaming = this.clientStreams.has(messageId);
    if (isStreaming) {
      const invocation = this.clientStreams.get(
        messageId,
      )!;
      this.events.dispatchEvent(new CustomEvent(messageId, { detail: request }))
      return await invocation;
    }
    const generator = () => {
      return createEventIterator<BebopRecord>(({ emit, cancel }) => {
        const eventHandler = async (req: CustomEvent<Message>) => {
          if (this.hooks !== undefined) {
            await this.hooks.executeRequestHooks(context);
          }
          if (req.detail.status === TempoStatusCode.CANCELLED) {
            cancel();
            return;
          }
          const requestData = req.detail.data!;
          const record = this.deserializeRequest(
            requestData,
            method,
            contentType,
          );
          if (this.hooks !== undefined) {
            await this.hooks.executeDecodeHooks(context, record);
          }
          emit(record);
        };

        this.events.addEventListener(messageId, eventHandler as unknown as EventListener)
        this.events.dispatchEvent(new CustomEvent(messageId, { detail: Message }))

        return () => {
          this.events.removeEventListener(messageId, eventHandler as unknown as EventListener)
          this.clientStreams.delete(messageId);
        };
      });
    };
    const invocation = method.invoke(generator, context)
    this.clientStreams.set(messageId, invocation);
    return await invocation;
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
    const requestData = request.data!;
    const record = this.deserializeRequest(requestData, method, contentType);
    if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
      throw new TempoError(
        TempoStatusCode.INTERNAL,
        'service method incorrect: method must be async generator',
      );
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
    const messageId = request.messageId!.toString()
    const isStreaming = this.clientStreams.has(messageId);
    if (isStreaming) {
      const invocation = this.clientStreams.get(
        messageId,
      )!;
      this.events.dispatchEvent(new CustomEvent(messageId, { detail: request }))
      return invocation;
    }
    const generator = () => {
      return createEventIterator<BebopRecord>(({ emit, cancel }) => {
        const eventHandler = async (req: CustomEvent<Message>) => {
          if (this.hooks !== undefined) {
            await this.hooks.executeRequestHooks(context);
          }
          if (request.status === TempoStatusCode.CANCELLED) {
            cancel();
            return;
          }
          const requestData = req.detail.data!;
          const record = this.deserializeRequest(
            requestData,
            method,
            contentType,
          );
          if (this.hooks !== undefined) {
            await this.hooks.executeDecodeHooks(context, record);
          }
          emit(record);
        };

        this.events.addEventListener(messageId, eventHandler as unknown as EventListener)
        this.events.dispatchEvent(new CustomEvent(messageId, { detail: Message }))

        return () => {
          this.events.removeEventListener(messageId, eventHandler as unknown as EventListener)
          this.clientStreams.delete(messageId);
        };
      });
    };


    if (!TempoUtil.isAsyncGeneratorFunction(method.invoke)) {
      throw new TempoError(
        TempoStatusCode.INTERNAL,
        'service method incorrect: method must be async generator',
      );
    }
    const invocation = method.invoke(generator, context)
    this.clientStreams.set(messageId, invocation);
    return invocation;
  }

  private makeCustomMetaData(_metadata: Map<string, string>): Metadata {
    const metadata = new Metadata();
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (metadata as any).data = _metadata;
    return metadata;
  }

  public override async process(
    req: string | Buffer,
    response: Message,
    env: ServerWebSocket<TEnv>,
  ) {
    let request: Message;
    let contentType: 'json' | 'bebop';
    if (typeof req === 'string') {
      try {
        contentType = 'json';
        request = new Message(JSON.parse(req) as IMessage);
        // biome-ignore lint/suspicious/noExplicitAny: <explanation>
      } catch (e: any) {
        throw new TempoError(TempoStatusCode.UNKNOWN_CONTENT_TYPE, e.message);
      }
    } else {
      contentType = 'bebop';
      request = new Message(Message.decode(req as unknown as Uint8Array));
    }
    try {
      const methodId = request.methodId!;
      const method = this.registry.getMethod(methodId);
      if (!method) {
        throw new TempoError(
          TempoStatusCode.NOT_FOUND,
          `no service is registered which contains a method of '${methodId}'`,
        );
      }
      const metadataHeader = request.customMetadata;
      const metadata = metadataHeader
        ? this.makeCustomMetaData(metadataHeader)
        : new Metadata();

      const previousAttempts = request.customMetadata?.get(
        'tempo-previous-rpc-attempts',
      );
      if (previousAttempts !== undefined) {
        const numberOfAttempts = previousAttempts.at(0);
        if (
          numberOfAttempts &&
          Number(numberOfAttempts) > this.maxRetryAttempts
        ) {
          throw new TempoError(
            TempoStatusCode.RESOURCE_EXHAUSTED,
            'max retry attempts exceeded',
          );
        }
      }

      let deadline: Deadline | undefined;
      const deadlineHeader = request.deadline;
      if (deadlineHeader !== undefined) {
        deadline = new Deadline(deadlineHeader);
      }
      if (deadline !== undefined && deadline.isExpired()) {
        throw new TempoError(
          TempoStatusCode.DEADLINE_EXCEEDED,
          'incoming request has already exceeded its deadline',
        );
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
        let recordGenerator:
          | AsyncGenerator<BebopRecord, void, undefined>
          | undefined = undefined;
        let record: BebopRecord | undefined;
        switch (method.type) {
          case MethodType.Unary:
            record = await this.invokeUnaryMethod(
              request,
              context,
              method,
              contentType,
            );
            break;
          case MethodType.ClientStream:
            record = await this.invokeClientStreamMethod(
              request,
              context,
              method,
              contentType,
            );
            break;
          case MethodType.ServerStream:
            recordGenerator = await this.invokeServerStreamMethod(
              request,
              context,
              method,
              contentType,
            );
            break;
          case MethodType.DuplexStream:
            recordGenerator = await this.invokeDuplexStreamMethod(
              request,
              context,
              method,
              contentType,
            );
            break;
          default:
            throw new TempoError(
              TempoStatusCode.INTERNAL,
              'service method incorrect: unknown method type',
            );
        }

        const outgoingCredential = context.outgoingCredential;
        if (outgoingCredential) {
          response.credential = stringifyCredential(outgoingCredential);
        }
        response.methodId = request.methodId;
        response.messageId = request.messageId;
        response.status = TempoStatusCode.OK;
        response.msg = 'OK';
        if (this.hooks !== undefined) {
          await this.hooks.executeResponseHooks(context);
        }
        outgoingMetadata.freeze();
        if (outgoingMetadata.size() > 0) {
          //@ts-expect-error
          response.customMetadata = outgoingMetadata.data;
        }
        if (recordGenerator !== undefined) {
          const writeFrames = async () => {
            for await (const value of recordGenerator) {
              const responseData = this.serializeResponse(
                value,
                method,
                contentType,
              );
              response.data = responseData;
              env.send(
                this.serializeResponse(response, method, contentType),
                true,
              );
            }
          };

          if (deadline) {
            await deadline.executeWithinDeadline(writeFrames);
          } else {
            await writeFrames();
          }
        } else {
          if (record === undefined) {
            throw new TempoError(
              TempoStatusCode.INTERNAL,
              'service method did not return a record',
            );
          }
          const responseData = this.serializeResponse(
            record,
            method,
            contentType,
          );
          response.data = responseData;
          env.send(this.serializeResponse(response, method, contentType), true);
        }
      };
      deadline !== undefined
        ? await deadline.executeWithinDeadline(handleRequest)
        : await handleRequest();
    } catch (e) {
      let status = TempoStatusCode.UNKNOWN;
      let message = 'unknown error';
      if (e instanceof TempoError) {
        status = e.status;
        message = e.message;
        // dont expose internal error messages to the client
        if (
          e.status === TempoStatusCode.INTERNAL &&
          this.transmitInternalErrors !== true
        ) {
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
      // cleanup any lingering event emitters
      this.clientStreams.delete(request.messageId!.toString());
      response.status = status;
      response.msg = message;
    }
  }

  override handle(
    _request: string | Buffer,
    _env: ServerWebSocket<TEnv>,
  ): Promise<Message> {
    throw new TempoError(
      TempoStatusCode.UNIMPLEMENTED,
      'Method not implemented.',
    );
  }
}
