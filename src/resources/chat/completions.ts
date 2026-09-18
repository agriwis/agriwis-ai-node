import type { APIPromise, ResourceRequestOptions } from '../../core/api.js';
import type { Stream } from '../../core/streaming.js';
import type {
  ChatCompletion,
  ChatCompletionChunk,
  CompletionCreateParams,
  CompletionCreateParamsNonStreaming,
  CompletionCreateParamsStreaming,
} from '../../types/index.js';
import { APIResource } from '../resource.js';

export class Completions extends APIResource {
  /** 非流式调用（stream 为 false 或缺省） */
  create(
    body: CompletionCreateParamsNonStreaming,
    options?: ResourceRequestOptions,
  ): APIPromise<ChatCompletion>;

  /** 流式调用（stream: true），返回可 for-await 消费的 SSE Stream */
  create(
    body: CompletionCreateParamsStreaming,
    options?: ResourceRequestOptions,
  ): APIPromise<Stream<ChatCompletionChunk>>;

  create(
    body: CompletionCreateParams,
    options?: ResourceRequestOptions,
  ): APIPromise<ChatCompletion | Stream<ChatCompletionChunk>> {
    return this._client.post('/chat/completions', {
      body,
      ...options,
      stream: body.stream ?? false,
    });
  }
}
