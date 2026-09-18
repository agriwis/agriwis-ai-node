import { APIClient, type Fetch, type HeadersLike } from './core/api.js';
import { AgriwisError } from './lib/errors.js';
import { Chat } from './resources/chat/chat.js';

export interface ClientOptions {
  /**
   * API Key。默认按顺序读取环境变量 AGRIWIS_API_KEY、SHUNONG_API_KEY。
   * 仅应在可信的后端环境使用；浏览器端请求会暴露密钥。
   */
  apiKey?: string;
  /** API 基础地址，默认 https://ai.agriwis.com/api/v1 */
  baseURL?: string;
  /** 单次请求超时时间（毫秒），默认 60000 */
  timeout?: number;
  /** 408/429/5xx 自动重试次数，默认 2 */
  maxRetries?: number;
  /** 附加到所有请求的自定义请求头 */
  defaultHeaders?: HeadersLike;
  /** 自定义 fetch 实现（测试或代理场景） */
  fetch?: Fetch;
}

export const DEFAULT_BASE_URL = 'https://ai.agriwis.com/api/v1';
export const DEFAULT_TIMEOUT = 60_000;
export const DEFAULT_MAX_RETRIES = 2;

const readEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    return process.env[key];
  }
  return undefined;
};

/**
 * 蜀农 AI API 客户端。
 *
 * @example
 * ```ts
 * const client = new Agriwis(); // 读取 AGRIWIS_API_KEY 环境变量
 * const completion = await client.chat.completions.create({
 *   model: 'auto',
 *   messages: [{ role: 'user', content: '你好' }],
 * });
 * console.log(completion.choices[0]?.message.content);
 * ```
 */
export class Agriwis {
  apiKey: string;
  baseURL: string;
  timeout: number;
  maxRetries: number;
  /** Chat Completions 资源命名空间 */
  chat: Chat;

  private readonly client: APIClient;

  constructor(opts: ClientOptions = {}) {
    const apiKey = opts.apiKey ?? readEnv('AGRIWIS_API_KEY') ?? readEnv('SHUNONG_API_KEY');
    if (!apiKey) {
      throw new AgriwisError(
        '缺少 API Key：请设置 AGRIWIS_API_KEY 环境变量，或在初始化时传入，' +
          "例如 new Agriwis({ apiKey: 'My API Key' })。",
      );
    }
    if (typeof window !== 'undefined') {
      // 浏览器端直接持有密钥会暴露给所有用户
      console.warn(
        'Agriwis：检测到浏览器环境。API Key 仅应在可信的后端环境使用，' +
          '建议由后端代理调用。',
      );
    }

    this.apiKey = apiKey;
    this.baseURL = opts.baseURL ?? DEFAULT_BASE_URL;
    this.timeout = opts.timeout ?? DEFAULT_TIMEOUT;
    this.maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

    this.client = new APIClient({
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      timeout: this.timeout,
      maxRetries: this.maxRetries,
      defaultHeaders: {
        'x-stainless-lang': 'js',
        'x-stainless-package-version': '0.1.0',
        ...opts.defaultHeaders,
      },
      fetch: opts.fetch,
    });

    this.chat = new Chat(this.client);
  }
}
