import type { ChatCompletion, ChatCompletionChunk, Usage } from './chat';
import type { Message } from './messages';
import type { FinishReason } from './shared';
import type { Tool, ToolChoice } from './tools';

export * from './chat.js';
export * from './messages.js';
export * from './shared.js';
export * from './tools.js';

/** Chat Completions 请求公共参数 */
export interface CompletionCreateParamsBase {
  /** 要使用的模型名称 */
  model: string;
  /** 按时间顺序排列的消息列表 */
  messages: Message[];
  /** 采样随机性，值越高输出越多样 */
  temperature?: number;
  /** 核采样阈值 */
  top_p?: number;
  /** 限制本次生成的最大输出长度 */
  max_tokens?: number;
  /** 触发后停止生成的字符串 */
  stop?: string | string[];
  /** 可供模型选择的工具定义 */
  tools?: Tool[];
  /** 控制是否以及调用哪个工具 */
  tool_choice?: ToolChoice;
  /** 终端用户标识 */
  user?: string;
}

/** 非流式请求（stream 为 false 或缺省） */
export interface CompletionCreateParamsNonStreaming extends CompletionCreateParamsBase {
  stream?: false | null;
}

/** 流式请求（stream: true），响应为 SSE 事件流 */
export interface CompletionCreateParamsStreaming extends CompletionCreateParamsBase {
  stream: true;
}

export type CompletionCreateParams = CompletionCreateParamsNonStreaming | CompletionCreateParamsStreaming;

export type { ChatCompletion, ChatCompletionChunk, Usage, FinishReason };
