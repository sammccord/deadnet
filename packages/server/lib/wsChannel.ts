import type { IMessage, Message } from '@deadnet/bebop';
import {
  BaseChannel,
  type CallCredential,
  type CallOptions,
  type ClientContext,
  InsecureChannelCredential,
  type MethodInfo,
  type RetryPolicy,
  type TempoChannelOptions,
} from '@tempojs/client';
import {
  type BebopContentType,
  ConsoleLogger,
  type Credential,
  type Deadline,
  ExecutionEnvironment,
  Metadata,
  type MethodType,
  TempoError,
  TempoStatusCode,
  TempoUtil,
  TempoVersion,
  parseCredential,
  tempoStream,
} from '@tempojs/common';
import type { BebopRecord } from 'bebop';
import {
  type Backoff,
  type Queue,
  type Websocket,
  type WebsocketBuffer,
  WebsocketBuilder,
  WebsocketEvent,
} from 'websocket-ts';

export type TempoWSChannelOptions = TempoChannelOptions & {
  binaryType?: BinaryType;
  buffer?: WebsocketBuffer;
  backoff?: Backoff;
};

/**
 * Represents a Tempo channel for communication with a remote server.
 */
export class TempoWSChannel extends BaseChannel {
  public static readonly defaultMaxRetryAttempts: number = 5;
  public static readonly defaultMaxReceiveMessageSize: number = 1024 * 1024 * 4; // 4 MB
  public static readonly defaultMaxSendMessageSize: number = 1024 * 1024 * 4; // 4 MB
  public static readonly defaultCredential: CallCredential =
    InsecureChannelCredential.create();
  public static readonly defaultContentType: BebopContentType = 'bebop';

  public readonly ws: Websocket;

  private readonly isSecure: boolean;
  private readonly maxReceiveMessageSize: number;
  private readonly credential: CallCredential;
  private readonly userAgent: string;

  /**
   * Constructs a new TempoChannel instance.
   *
   * @param {URL} target - The target URL for the channel.
   * @param {TempoWSChannelOptions} options - The configuration options for the channel.
   * @protected
   */
  protected constructor(target: URL, options: TempoWSChannelOptions) {
    super(
      target,
      options.logger ?? new ConsoleLogger('TempoChannel'),
      options.contentType ?? TempoWSChannel.defaultContentType,
    );
    this.logger.debug('creating new TempoChannel');
    this.isSecure = target.protocol === 'https:' || target.protocol === 'wss:';
    this.credential = options.credential ?? TempoWSChannel.defaultCredential;
    if (
      !this.isSecure &&
      !(this.credential instanceof InsecureChannelCredential) &&
      options.unsafeUseInsecureChannelCallCredential !== true
    ) {
      throw new Error('Cannot use secure credential with insecure channel');
    }
    this.maxReceiveMessageSize =
      options.maxReceiveMessageSize ??
      TempoWSChannel.defaultMaxReceiveMessageSize;
    this.credential = options.credential ?? TempoWSChannel.defaultCredential;
    this.userAgent = TempoUtil.buildUserAgent(
      'javascript',
      TempoVersion,
      undefined,
      {
        runtime: TempoUtil.getEnvironmentName(),
      },
    );

    let ws = new WebsocketBuilder(target.toString());
    if (options.backoff) ws = ws.withBackoff(options.backoff);
    if (options.buffer) ws = ws.withBuffer(options.buffer);
    this.ws = ws.build();
    this.ws.binaryType = options.binaryType || 'arraybuffer';

    // Add event listeners
    this.ws.addEventListener(WebsocketEvent.open, () =>
      this.logger.debug(
        `opened TempoWSChannel for ${target.href} / ${this.userAgent}`,
      ),
    );
    this.ws.addEventListener(WebsocketEvent.close, () =>
      this.logger.debug(
        `closed TempoWSChannel for ${target.href} / ${this.userAgent}`,
      ),
    );

    this.logger.debug(
      `created new TempoWSChannel for ${target.href} / ${this.userAgent}`,
    );
  }

  /**
   * Creates a new TempoChannel instance for the specified address.
   *
   * @overload
   * @param {string} address - The target address as a string.
   * @returns {TempoChannel} - A new TempoChannel instance.
   */
  static forAddress(address: string): TempoWSChannel;
  /**
   * Creates a new TempoChannel instance for the specified address.
   *
   * @overload
   * @param {string} address - The target address as a string.
   * @param {TempoChannelOptions} options - Configuration options for the channel.
   * @returns {TempoChannel} - A new TempoChannel instance.
   */
  static forAddress(
    address: string,
    options: TempoChannelOptions,
  ): TempoWSChannel;
  /**
   * Creates a new TempoChannel instance for the specified address.
   *
   * @overload
   * @param {URL} address - The target address as a URL object.
   * @returns {TempoChannel} - A new TempoChannel instance.
   */
  static forAddress(address: URL): TempoWSChannel;

  /**
   * Creates a new TempoChannel instance for the specified address.
   *
   * @param {string | URL} address - The target address as a string or URL object.
   * @param {TempoChannelOptions} [options] - Optional configuration options for the channel.
   * @returns {TempoChannel} - A new TempoChannel instance.
   */
  static forAddress(
    address: string | URL,
    options?: TempoWSChannelOptions,
  ): TempoWSChannel {
    if (!address) {
      throw new Error('no address');
    }
    if (typeof address === 'string') {
      address = new URL(address);
    }
    options ??= {};
    return new TempoWSChannel(address, options);
  }

  public override async removeCredential(): Promise<void> {
    await this.credential.removeCredential();
  }
  public override async getCredential(): Promise<Credential | undefined> {
    return await this.credential.getCredential();
  }

  /**
   * Executes a function with retries according to the provided retry policy.
   * The function will be retried if it fails with a TempoError and its status code is included in the retryableStatusCodes of the retry policy.
   * If a deadline is provided, the deadline for each attempt will be managed by the provided deadline, but the deadline will not be reset upon each retry.
   *
   * @template T - The type of the result returned by the function.
   * @param {((retryAttempt: number) => Promise<T>)} func - A function that returns a Promise with a result. The function will receive a number indicating the current retry attempt.
   * @param {RetryPolicy} retryPolicy - An object defining the retry policy, including maxAttempts, initialBackoff, maxBackoff, backoffMultiplier, and retryableStatusCodes.
   * @param {Deadline} [deadline] - An optional deadline object that manages the timeout for each attempt.
   * @param {AbortController} [abortController] - An optional AbortController instance to cancel the function execution.
   * @returns {Promise<T>} - A Promise that resolves with the result of the function if it completes within the deadline and retry policy constraints.
   * @throws {Error} - If the function execution fails and the error does not match the retry policy, or if the maximum number of attempts is reached without a successful result.
   */
  async executeWithRetry<T>(
    func: (retryAttempt: number) => Promise<T>,
    retryPolicy: RetryPolicy,
    deadline?: Deadline,
    abortController?: AbortController,
  ): Promise<T> {
    let attempt = 0;
    let lastError: Error | undefined;

    const execute = deadline
      ? (retryAttempt: number) =>
          deadline.executeWithinDeadline(
            async () => await func(retryAttempt),
            abortController,
          )
      : (retryAttempt: number) => func(retryAttempt);

    while (attempt < retryPolicy.maxAttempts) {
      try {
        // Attempt to execute the function within the deadline, if provided.
        const result = await execute(attempt);
        return result;
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new TempoError(TempoStatusCode.UNKNOWN, `unexpected error`, {
            data: error,
          });
        }
        lastError = error;
        // If error is not an instance of TempoError or the status code is not in retryableStatusCodes, throw the error.
        if (
          !(error instanceof TempoError) ||
          !retryPolicy.retryableStatusCodes.includes(error.status)
        ) {
          throw error;
        }

        // Calculate the backoff time for this attempt.
        const backoffTime = Math.min(
          retryPolicy.initialBackoff.multiply(
            Math.pow(retryPolicy.backoffMultiplier, attempt),
          ).totalMilliseconds,
          retryPolicy.maxBackoff.totalMilliseconds,
        );

        // Add some jitter to the backoff time.
        const backoffWithJitter = backoffTime * (Math.random() * 0.5 + 0.75);

        // Wait for the backoff duration.
        await new Promise<void>((resolve) =>
          setTimeout(resolve, backoffWithJitter),
        );

        // Increment the attempt counter.
        attempt++;
      }
    }

    if (
      abortController &&
      lastError !== undefined &&
      !(lastError instanceof Error && lastError.name === 'AbortError') &&
      !(
        lastError instanceof TempoError &&
        lastError.status === TempoStatusCode.ABORTED
      )
    ) {
      abortController.abort();
    }

    return Promise.reject(
      lastError ||
        new TempoError(
          TempoStatusCode.DEADLINE_EXCEEDED,
          'Failed to execute function with retry policy',
        ),
    );
  }

  /**
   * Fetches data from the specified target using the provided request options.
   *
   * @param {RequestInit} init - The request options to be used with the fetch API.
   * @returns {Promise<Response>} - A promise resolving to the Response object.
   * @throws {TempoError} - Throws a TempoError with a specific TempoStatusCode in case of network issues,
   *                        invalid URL, fetch abort, or any unexpected error.
   * @private
   */
  private async fetchData(init: RequestInit): Promise<Response> {
    try {
      return await fetch(this.target, init);
    } catch (error) {
      if (error instanceof Error) {
        // depending on the runtime (browser vs node) the error message may be different, but they all mean
        // they failed to connect to the target
        if (
          error.message.match(/(failed to fetch)|(load failed)|(fetch failed)/i)
        ) {
          throw new TempoError(
            TempoStatusCode.UNAVAILABLE,
            'RPC fetch failed to target',
            error,
          );
          // this means the AbortController was signaled to abort the fetch
        } else if (error.name === 'AbortError') {
          throw new TempoError(
            TempoStatusCode.ABORTED,
            'RPC fetch aborted',
            error,
          );
        }
        throw new TempoError(
          TempoStatusCode.UNKNOWN,
          `unexpected error while fetching`,
          error,
        );
      }
      throw new TempoError(
        TempoStatusCode.UNKNOWN,
        `unexpected error while fetching`,
        { data: error },
      );
    }
  }

  /**
   * Creates a `RequestInit` object for a given payload, context, method and optional call options.
   * This object can be used to make an HTTP request using the Fetch API.
   *
   * @private
   * @param {Uint8Array | ReadableStream<Uint8Array>} payload - The payload to be sent in the request.
   * @param {ClientContext} context - The context of the client making the request.
   * @param {MethodInfo<BebopRecord, BebopRecord>} method - Information about the method being called.
   * @param {CallOptions | undefined} options - Optional configuration for the call.
   * @returns {Promise<RequestInit>} A Promise resolving to the created `RequestInit` object.
   * @throws {TempoError} Throws an error if there's a problem while getting the credential header.
   */
  private async createRequest(
    payload: Uint8Array | ReadableStream<Uint8Array>,
    context: ClientContext,
    method: MethodInfo<BebopRecord, BebopRecord>,
    options?: CallOptions | undefined,
  ): Promise<Message> {
    // Set up request headers

    const customMetadata = new Map<string, [string]>();
    customMetadata.set('path', [`/${method.service}/${method.name}`]);
    customMetadata.set('service-name', [method.service]);
    const requestInit: IMessage = {
      methodId: method.id,
      customMetadata: new Map(),
    };
    if (options?.deadline) {
      requestInit.deadline = new Date(options.deadline.toUnixTimestamp());
    }
    // we can't modify the useragent in browsers, so use x-user-agent instead
    if (ExecutionEnvironment.isBrowser || ExecutionEnvironment.isWebWorker) {
      customMetadata.set('x-user-agent', [this.userAgent]);
    } else {
      customMetadata.set('user-agent', [this.userAgent]);
    }
    const credentialHeader = await this.credential.getHeader();
    if (credentialHeader) {
      headers.set(credentialHeader.name, credentialHeader.value);
      requestInit.credentials = 'include';
      requestInit.cache = 'no-cache';
    }
    return requestInit;
  }

  private makeCustomMetaData(_metadata: Map<string, string[]>): Metadata {
    const metadata = new Metadata();
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    (metadata as any).data = _metadata;
    return metadata;
  }

  /**
   * Processes the headers of the response from the server, validating their integrity and correctness.
   * Also sets the incoming metadata from the response headers to the provided context.
   *
   * @private
   * @param {Response} response - The response received from the server.
   * @param {ClientContext} context - The context of the client making the request.
   * @param {MethodType} methodType - The type of method being called.
   * @throws {TempoError} Throws an error if any validation checks fail or if there's a problem parsing or storing credentials.
   */
  private async processResponseHeaders(
    response: Message,
    context: ClientContext,
    methodType: MethodType,
  ) {
    // Validate response headers
    const statusCode: TempoStatusCode | undefined = response.status;
    if (statusCode === undefined) {
      throw new TempoError(
        TempoStatusCode.UNKNOWN,
        'tempo-status missing from response.',
      );
    }

    if (statusCode !== TempoStatusCode.OK) {
      let tempoMessage = response.msg;
      if (!tempoMessage) {
        tempoMessage = 'unknown error';
      }
      throw new TempoError(statusCode, tempoMessage);
    }

    // const responseContentType = response.headers.get('content-type');
    // if (responseContentType === null) {
    //   throw new TempoError(
    //     TempoStatusCode.INVALID_ARGUMENT,
    //     'content-type missing on response',
    //   );
    // }
    // const contentType = TempoUtil.parseContentType(responseContentType);
    // if (contentType.format !== this.contentType) {
    //   throw new TempoError(
    //     TempoStatusCode.INVALID_ARGUMENT,
    //     `response content-type does not match request: ${contentType.format} !== ${this.contentType}`,
    //   );
    // }
    // if (
    //   methodType === MethodType.Unary ||
    //   methodType === MethodType.ClientStream
    // ) {
    //   const contentLength = response.headers.get('content-length');
    //   if (contentLength === null) {
    //     throw new TempoError(
    //       TempoStatusCode.OUT_OF_RANGE,
    //       'response did not contain a valid content-length header',
    //     );
    //   }
    //   if (TempoUtil.tryParseInt(contentLength) > this.maxReceiveMessageSize) {
    //     throw new TempoError(
    //       TempoStatusCode.OUT_OF_RANGE,
    //       'response exceeded max receive message size',
    //     );
    //   }
    // }
    // Set incoming metadata from response headers
    const customHeader = response.customMetadata;
    if (customHeader?.size || 0 > 0) {
      context.incomingMetadata = this.makeCustomMetaData(metadataHeader);
    }
    const responseCredential = response.credential;
    if (responseCredential) {
      const credential = parseCredential(responseCredential);
      if (!credential) {
        throw new TempoError(
          TempoStatusCode.INVALID_ARGUMENT,
          "unable to parse credentials received on 'tempo-credential' header",
        );
      }
      await this.credential.storeCredential(credential);
    }
  }

  /**
   * {@inheritDoc BaseChannel.startUnary}
   */
  public override async startUnary<
    TRequest extends BebopRecord,
    TResponse extends BebopRecord,
  >(
    request: TRequest,
    context: ClientContext,
    method: MethodInfo<TRequest, TResponse>,
    options?: CallOptions | undefined,
  ): Promise<TResponse> {
    try {
      // Prepare request data based on content type
      const requestData: Uint8Array = this.serializeRequest(request, method);
      if (this.hooks !== undefined) {
        await this.hooks.executeRequestHooks(context);
      }
      const requestInit = await this.createRequest(
        requestData,
        context,
        method,
        options,
      );
      let response: Response;
      // If the retry policy is set, execute the request with retries
      if (options?.retryPolicy) {
        response = await this.executeWithRetry(
          async (retryAttempt: number) => {
            if (retryAttempt > 0) {
              context.outgoingMetadata.set(
                'tempo-previous-rpc-attempts',
                String(retryAttempt),
              );
              if (requestInit.headers instanceof Headers) {
                requestInit.headers.set(
                  'custom-metadata',
                  context.outgoingMetadata.toHttpHeader(),
                );
              }
            }
            return await this.fetchData(requestInit);
          },
          options.retryPolicy,
          options.deadline,
          options.controller,
        );
        // If the deadline is set, execute the request within the deadline
      } else if (options?.deadline) {
        response = await options.deadline.executeWithinDeadline(async () => {
          return await this.fetchData(requestInit);
        }, options.controller);
      } else {
        // Otherwise, just execute the request indefinitely
        response = await this.fetchData(requestInit);
      }
      // Validate response headers
      await this.processResponseHeaders(response, context, method.type);
      if (this.hooks !== undefined) {
        await this.hooks.executeResponseHooks(context);
      }
      // Deserialize the response based on the content type
      const responseData = new Uint8Array(await response.arrayBuffer());
      const record: TResponse = this.deserializeResponse(responseData, method);
      if (this.hooks !== undefined) {
        await this.hooks.executeDecodeHooks(context, record);
      }
      // Return the deserialized response object
      return record;
    } catch (e) {
      if (this.hooks !== undefined && e instanceof Error) {
        this.hooks.executeErrorHooks(context, e);
      }
      if (e instanceof TempoError) {
        throw e;
      }
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
        } else {
          throw new TempoError(
            TempoStatusCode.UNKNOWN,
            'an unknown error occurred',
            e,
          );
        }
      }
      throw new TempoError(
        TempoStatusCode.UNKNOWN,
        'an unknown error occurred',
        { data: e },
      );
    }
  }

  /**
   * {@inheritDoc BaseChannel.startClientStream}
   */
  public override async startClientStream<
    TRequest extends BebopRecord,
    TResponse extends BebopRecord,
  >(
    generator: () => AsyncGenerator<TRequest, void, undefined>,
    context: ClientContext,
    method: MethodInfo<TRequest, TResponse>,
    options?: CallOptions | undefined,
  ): Promise<TResponse> {
    try {
      const transformStream = new TransformStream<Uint8Array, Uint8Array>();
      tempoStream.writeTempoStream(
        transformStream.writable,
        generator(),
        (payload: TRequest) => this.serializeRequest(payload, method),
        options?.deadline,
        options?.controller,
      );
      if (this.hooks !== undefined) {
        await this.hooks.executeRequestHooks(context);
      }
      const requestInit = await this.createRequest(
        transformStream.readable,
        context,
        method,
        options,
      );
      let response: Response;
      if (options?.deadline) {
        response = await options.deadline.executeWithinDeadline(async () => {
          return await this.fetchData(requestInit);
        }, options.controller);
      } else {
        // Otherwise, just execute the request indefinitely
        response = await this.fetchData(requestInit);
      }
      // Validate response headers
      await this.processResponseHeaders(response, context, method.type);
      // Deserialize the response based on the content type
      const responseData = new Uint8Array(await response.arrayBuffer());
      const record: TResponse = this.deserializeResponse(responseData, method);
      if (this.hooks !== undefined) {
        await this.hooks.executeDecodeHooks(context, record);
      }
      // Return the deserialized response object
      return record;
    } catch (e) {
      if (this.hooks !== undefined && e instanceof Error) {
        this.hooks.executeErrorHooks(context, e);
      }
      if (e instanceof TempoError) {
        throw e;
      }
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
        } else {
          throw new TempoError(
            TempoStatusCode.UNKNOWN,
            'an unknown error occurred',
            e,
          );
        }
      }
      throw new TempoError(
        TempoStatusCode.UNKNOWN,
        'an unknown error occurred',
        { data: e },
      );
    }
  }
  /**
   * {@inheritDoc BaseChannel.startServerStream}
   */
  public override async startServerStream<
    TRequest extends BebopRecord,
    TResponse extends BebopRecord,
  >(
    request: TRequest,
    context: ClientContext,
    method: MethodInfo<TRequest, TResponse>,
    options?: CallOptions | undefined,
  ): Promise<AsyncGenerator<TResponse, void, undefined>> {
    try {
      // Prepare request data based on content type
      const requestData: Uint8Array = this.serializeRequest(request, method);
      if (this.hooks !== undefined) {
        await this.hooks.executeRequestHooks(context);
      }
      const requestInit = await this.createRequest(
        requestData,
        context,
        method,
        options,
      );

      let response: Response;
      // If the retry policy is set, execute the request with retries
      if (options?.retryPolicy) {
        response = await this.executeWithRetry(
          async (retryAttempt: number) => {
            if (retryAttempt > 0) {
              context.outgoingMetadata.set(
                'tempo-previous-rpc-attempts',
                String(retryAttempt),
              );
              if (requestInit.headers instanceof Headers) {
                requestInit.headers.set(
                  'custom-metadata',
                  context.outgoingMetadata.toHttpHeader(),
                );
              }
            }
            return await this.fetchData(requestInit);
          },
          options.retryPolicy,
          options.deadline,
          options.controller,
        );
        // If the deadline is set, execute the request within the deadline
      } else if (options?.deadline) {
        response = await options.deadline.executeWithinDeadline(async () => {
          return await this.fetchData(requestInit);
        }, options.controller);
      } else {
        // Otherwise, just execute the request indefinitely
        response = await this.fetchData(requestInit);
      }

      // Validate response headers
      await this.processResponseHeaders(response, context, method.type);
      if (response.body === null) {
        throw new TempoError(TempoStatusCode.INTERNAL, 'response body is null');
      }
      const body = response.body;
      return tempoStream.readTempoStream(
        body,
        async (buffer: Uint8Array) => {
          if (buffer.length > this.maxReceiveMessageSize) {
            throw new TempoError(
              TempoStatusCode.RESOURCE_EXHAUSTED,
              `received message larger than ${this.maxReceiveMessageSize} bytes`,
            );
          }
          const record = this.deserializeResponse(buffer, method);
          if (this.hooks !== undefined) {
            await this.hooks.executeDecodeHooks(context, record);
          }
          return record;
        },
        options?.deadline,
        options?.controller,
      );
    } catch (e) {
      if (this.hooks !== undefined && e instanceof Error) {
        this.hooks.executeErrorHooks(context, e);
      }
      if (e instanceof TempoError) {
        throw e;
      }
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
        } else {
          throw new TempoError(
            TempoStatusCode.UNKNOWN,
            'an unknown error occurred',
            e,
          );
        }
      }
      throw new TempoError(
        TempoStatusCode.UNKNOWN,
        'an unknown error occurred',
        { data: e },
      );
    }
  }
  /**
   * {@inheritDoc BaseChannel.startDuplexStream}
   */
  public override async startDuplexStream<
    TRequest extends BebopRecord,
    TResponse extends BebopRecord,
  >(
    generator: () => AsyncGenerator<TRequest, void, undefined>,
    context: ClientContext,
    method: MethodInfo<TRequest, TResponse>,
    options?: CallOptions | undefined,
  ): Promise<AsyncGenerator<TResponse, void, undefined>> {
    try {
      const transformStream = new TransformStream<Uint8Array, Uint8Array>();
      tempoStream.writeTempoStream(
        transformStream.writable,
        generator(),
        (payload: TRequest) => this.serializeRequest(payload, method),
        options?.deadline,
        options?.controller,
      );
      if (this.hooks !== undefined) {
        await this.hooks.executeRequestHooks(context);
      }
      const requestInit = await this.createRequest(
        transformStream.readable,
        context,
        method,
        options,
      );
      let response: Response;
      if (options?.deadline) {
        response = await options.deadline.executeWithinDeadline(async () => {
          return await this.fetchData(requestInit);
        }, options.controller);
      } else {
        // Otherwise, just execute the request indefinitely
        response = await this.fetchData(requestInit);
      }
      // Validate response headers
      await this.processResponseHeaders(response, context, method.type);
      if (response.body === null) {
        throw new TempoError(TempoStatusCode.INTERNAL, 'response body is null');
      }
      const body = response.body;
      return tempoStream.readTempoStream(
        body,
        async (buffer: Uint8Array) => {
          if (buffer.length > this.maxReceiveMessageSize) {
            throw new TempoError(
              TempoStatusCode.RESOURCE_EXHAUSTED,
              `received message larger than ${this.maxReceiveMessageSize} bytes`,
            );
          }
          const record = this.deserializeResponse(buffer, method);
          if (this.hooks !== undefined) {
            await this.hooks.executeDecodeHooks(context, record);
          }
          return record;
        },
        options?.deadline,
        options?.controller,
      );
    } catch (e) {
      if (this.hooks !== undefined && e instanceof Error) {
        this.hooks.executeErrorHooks(context, e);
      }
      if (e instanceof TempoError) {
        throw e;
      }
      if (e instanceof Error) {
        if (e.name === 'AbortError') {
          throw new TempoError(TempoStatusCode.ABORTED, 'RPC fetch aborted', e);
        } else {
          throw new TempoError(
            TempoStatusCode.UNKNOWN,
            'an unknown error occurred',
            e,
          );
        }
      }
      throw new TempoError(
        TempoStatusCode.UNKNOWN,
        'an unknown error occurred',
        { data: e },
      );
    }
  }
}
