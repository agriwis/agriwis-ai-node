/** API 返回的错误响应体结构：{ error: { message, type, code } } */
export interface APIErrorBody {
  error: {
    message: string;
    type?: string;
    code?: string;
    param?: string;
  };
}

/** SDK 所有异常的基类 */
export class AgriwisError extends Error {}

/**
 * API 请求失败时抛出的错误，携带 HTTP 状态码、响应头与原始错误体。
 * 具体子类按状态码映射：
 * - 400 → {@link BadRequestError}
 * - 401 → {@link AuthenticationError}
 * - 403 → {@link PermissionDeniedError}
 * - 404 → {@link NotFoundError}
 * - 408 → {@link RequestTimeoutError}
 * - 413 / 422 → {@link UnprocessableEntityError}
 * - 429 → {@link RateLimitError}
 * - 5xx → {@link InternalServerError}
 */
export class APIError extends AgriwisError {
  readonly status: number | undefined;
  readonly headers: Headers | undefined;
  readonly error: APIErrorBody['error'] | undefined;

  constructor(
    status: number | undefined,
    message: string,
    headers: Headers | undefined,
    error: APIErrorBody['error'] | undefined,
  ) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.headers = headers;
    this.error = error;
  }

  static generate(
    status: number | undefined,
    errorBody: APIErrorBody | undefined,
    headers: Headers | undefined,
  ): APIError {
    const rawMessage = errorBody?.error?.message;
    const message = rawMessage ?? `Request failed with HTTP status ${status ?? 'unknown'}.`;
    const error = errorBody?.error;

    if (status === 400) return new BadRequestError(status, message, headers, error);
    if (status === 401) return new AuthenticationError(status, message, headers, error);
    if (status === 403) return new PermissionDeniedError(status, message, headers, error);
    if (status === 404) return new NotFoundError(status, message, headers, error);
    if (status === 408) return new RequestTimeoutError(status, message, headers, error);
    if (status === 413 || status === 422) {
      return new UnprocessableEntityError(status, message, headers, error);
    }
    if (status === 429) return new RateLimitError(status, message, headers, error);
    if (status !== undefined && status >= 500 && status < 600) {
      return new InternalServerError(status, message, headers, error);
    }
    return new APIError(status, message, headers, error);
  }
}

/** 请求被调用方主动中止时抛出 */
export class APIUserAbortError extends APIError {
  constructor(message = 'Request was aborted.') {
    super(undefined, message, undefined, undefined);
    this.name = 'APIUserAbortError';
  }
}

/** 网络连接失败（无法建立连接、DNS 失败等）时抛出 */
export class APIConnectionError extends APIError {
  constructor({ message = 'Connection error.', cause }: { message?: string; cause?: unknown } = {}) {
    super(undefined, message, undefined, undefined);
    this.name = 'APIConnectionError';
    Object.defineProperty(this, 'cause', {
      value: cause,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }
}

/** 请求超过 timeout 配置时抛出 */
export class APIConnectionTimeoutError extends APIConnectionError {
  constructor(message = 'Request timed out.') {
    super({ message });
    this.name = 'APIConnectionTimeoutError';
  }
}

/** 400：JSON 格式、参数类型或参数值不正确 */
export class BadRequestError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'BadRequestError';
  }
}

/** 401：API Key 缺失、错误、过期或已撤销 */
export class AuthenticationError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'AuthenticationError';
  }
}

/** 403：当前账号无权使用指定模型或接口 */
export class PermissionDeniedError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'PermissionDeniedError';
  }
}

/** 404：Base URL、接口路径或模型名称不正确 */
export class NotFoundError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'NotFoundError';
  }
}

/** 408：服务端在限定时间内未完成请求 */
export class RequestTimeoutError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'RequestTimeoutError';
  }
}

/** 413 / 422：输入内容或上传数据超过限制 */
export class UnprocessableEntityError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'UnprocessableEntityError';
  }
}

/** 429：触发频率限制或账户额度不足 */
export class RateLimitError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'RateLimitError';
  }
}

/** 5xx：服务内部异常或暂时不可用 */
export class InternalServerError extends APIError {
  constructor(status: number | undefined, message: string, headers: Headers | undefined, error: APIErrorBody['error'] | undefined) {
    super(status, message, headers, error);
    this.name = 'InternalServerError';
  }
}
