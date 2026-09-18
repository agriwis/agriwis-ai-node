import type { Annotation, ToolCall } from './chat';

/* ---------------------------------- 消息 ---------------------------------- */

export interface SystemMessage {
  role: 'system';
  /** 设定助手的行为、语气和约束 */
  content: string;
  name?: string;
}

export interface UserMessage {
  role: 'user';
  /** 字符串或多模态内容数组 */
  content: MessageContent;
  name?: string;
}

export interface AssistantMessage {
  role: 'assistant';
  content: string | null;
  name?: string;
  /** 模型历史回复中请求的工具调用，回传历史时需原样携带 */
  tool_calls?: ToolCall[] | null;
  annotations?: Annotation[] | null;
}

/** 工具执行结果消息，必须通过 tool_call_id 与模型发起的调用一一对应 */
export interface ToolMessage {
  role: 'tool';
  content: string;
  tool_call_id: string;
}

/** 按角色区分的消息判别联合 */
export type Message = SystemMessage | UserMessage | AssistantMessage | ToolMessage;

/* -------------------------------- 多模态内容 -------------------------------- */

export interface ContentPartText {
  type: 'text';
  text: string;
}

export interface ContentPartImage {
  type: 'image_url';
  image_url: {
    /** http(s) URL 或 Base64 Data URL（data:image/png;base64,...） */
    url: string;
    detail?: 'auto' | 'low' | 'high';
  };
}

export type ContentPart = ContentPartText | ContentPartImage;

export type MessageContent = string | ContentPart[];
