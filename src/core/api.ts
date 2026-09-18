import type { APIErrorBody } from '../lib/errors.js';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  APIUserAbortError,
} from '../lib/errors.js';
import { Stream } from './streaming.js';

export type Fetch = typeof fetch;
export type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type HeadersLike = Record<string, string | undefined>;

/** 底层请求选项；资源层仅使用 path 之外的字段 */
export interface RequestOptions {
  path: string;
  method?: HTTPMethod;
  body?: unknown;
  headers?: HeadersLike;
  /** 单次请求的超时时间（毫秒） */
  timeout?: number;
  /** 外部中止信号 */
  signal?: AbortSignal | null;
  /** 为 true 时返回 SSE Stream 而非解析后的 JSON */
  stream?: boolean;
}

export type ResourceRequestOptions = Omit<RequestOptions, 'path' | 'method'>;

export interface APIResult<T> {
  data: T;
  response: Response;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Promise 兼容封装：除最终解析结果外，还可通过 asResponse() 拿到原始 Response。
 * 实现 PromiseLike，可直接 await / .then() 消费。
 */
export class APIPromise<T> implements PromiseLike<T> {
  private readonly raw: Promise<APIResult<T>>;

  constructor(raw: Promise<APIResult<T>>) {
    this.raw = raw;
  }

  private parse(): Promise<T> {
    return this.raw.then((result) => result.data);
  }

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.parse().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): PromiseLike<T | TResult> {
    return this.parse().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.parse().finally(onfinally);
  }

  /** 获取原始 Response（不消费 body） */
  asResponse(): Promise<Response> {
    return this.raw.then((result) => result.response);
  }
}

/**
 * 统一请求封装：URL/Header 构建、JSON 序列化、超时（AbortController）、
 * 以及对 408/429/5xx 与连接错误的指数退避自动重试。
 */
export class APIClient {
  readonly baseURL: string;
  readonly apiKey: string;
  readonly timeout: number;
  readonly maxRetries: number;
  readonly defaultHeaders: HeadersLike;
  private readonly fetchFn: Fetch;

  constructor(opts: {
    apiKey: string;
    baseURL: string;
    timeout: number;
    maxRetries: number;
    defaultHeaders?: HeadersLike;
    fetch?: Fetch;
  }) {
    this.apiKey = opts.apiKey;
    this.baseURL = opts.baseURL.replace(/\/+$/, '');
    this.timeout = opts.timeout;
    this.maxRetries = opts.maxRetries;
    this.defaultHeaders = opts.defaultHeaders ?? {};
    this.fetchFn = opts.fetch ?? fetch.bind(globalThis);
  }

  post<T>(path: string, opts: ResourceRequestOptions = {}): APIPromise<T> {
    return this.request<T>({ path, method: 'POST', ...opts });
  }

  request<T>(opts: RequestOptions): APIPromise<T> {
    return new APIPromise<T>(this.makeRequest<T>(opts));
  }

  private async makeRequest<T>(opts: RequestOptions): Promise<APIResult<T>> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.attempt<T>(opts);
      } catch (err) {
        if (attempt >= this.maxRetries || !this.shouldRetry(err)) {
          throw err;
        }
        await sleep(this.retryDelay(err, attempt));
        attempt++;
      }
    }
  }

  /** 仅对 408/429/5xx 与连接类错误重试；400/401/403/404 等应修正请求后重发 */
  private shouldRetry(err: unknown): boolean {
    if (err instanceof APIConnectionError) return true;
    if (err instanceof APIError) {
      const { status } = err;
      if (status === undefined) return false;
      return status === 408 || status === 429 || (status >= 500 && status < 600);
    }
    return false;
  }

  /** 优先使用响应的 retry-after 头，否则指数退避：500ms、1s、2s...（上限 8s） */
  private retryDelay(err: unknown, attempt: number): number {
    if (err instanceof APIError && err.headers) {
      const retryAfter = err.headers.get('retry-after');
      if (retryAfter != null) {
        const seconds = Number(retryAfter);
        if (Number.isFinite(seconds) && seconds >= 0) {
          return Math.min(seconds * 1000, 60_000);
        }
      }
    }
    return Math.min(2 ** attempt * 500, 8_000);
  }

  private async attempt<T>(opts: RequestOptions): Promise<APIResult<T>> {
    const controller = new AbortController();
    const timeout = opts.timeout ?? this.timeout;
    let timedOut = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (timeout != null && timeout > 0) {
      timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeout);
    }

    const onUserAbort = () => controller.abort();
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', onUserAbort);
    }

    let response: Response;
    try {
      const init: RequestInit = {
        method: opts.method ?? 'POST',
        headers: this.buildHeaders(opts),
        signal: controller.signal,
      };
      if (opts.body !== undefined) {
        init.body = JSON.stringify(opts.body, null, 2);
      }
      response = await this.fetchFn(this.buildURL(opts.path), init);
    } catch (err) {
      if (opts.signal?.aborted) throw new APIUserAbortError();
      if (timedOut) throw new APIConnectionTimeoutError();
      throw new APIConnectionError({
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    } finally {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (opts.signal) opts.signal.removeEventListener('abort', onUserAbort);
    }

    if (opts.stream && response.ok && response.body) {
      // 流式场景下 T 应为 Stream<Chunk>，此处将 Stream 实例原样交回
      const stream = new Stream<unknown>(response, controller);
      return { data: stream as unknown as T, response };
    }

    if (!response.ok) {
      const errorBody = await this.parseErrorBody(response);
      throw APIError.generate(response.status, errorBody, response.headers);
    }

    let data: T;
    try {
      data = (await response.json()) as T;
    } catch (err) {
      throw new APIConnectionError({
        message: 'Failed to parse response body.',
        cause: err instanceof Error ? err : new Error(String(err)),
      });
    }
    return { data, response };
  }

  private buildURL(path: string): string {
    return `${this.baseURL}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private buildHeaders(opts: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {};
    const merge = (source: HeadersLike | undefined) => {
      if (!source) return;
      for (const [key, value] of Object.entries(source)) {
        if (value != null && value !== '') {
          headers[key.toLowerCase()] = value;
        }
      }
    };
    merge(this.defaultHeaders);
    merge(opts.headers);
    headers['authorization'] = `Bearer ${this.apiKey}`;
    if (opts.body !== undefined) {
      headers['content-type'] ??= 'application/json';
    }
    headers['accept'] ??= opts.stream ? 'text/event-stream' : 'application/json';
    return headers;
  }

  private async parseErrorBody(response: Response): Promise<APIErrorBody | undefined> {
    try {
      return (await response.json()) as APIErrorBody;
    } catch {
      return undefined;
    }
  }
}
