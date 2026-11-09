import type { FinishReason } from './shared';

/** 工具调用（非流式完整形态） */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    /** JSON 字符串形式的调用参数，需要应用侧自行 JSON.parse 并校验 */
    arguments: string;
  };
}

/** 工具调用（流式增量形态，参数以字符串分片逐步到达） */
export interface ToolCallChunk {
  index: number;
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
}

/** 模型返回的 assistant 消息（响应中） */
export interface ChatCompletionMessage {
  role: 'assistant';
  content: string | null;
  /** 模型请求执行的工具调用 */
  tool_calls?: ToolCall[] | null;
  /** 知识库检索 / 天气查询等的数据来源引用标注 */
  annotations?: Annotation[] | null;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatCompletionMessage;
  finish_reason: FinishReason;
}

/** 非流式 Chat Completions 响应 */
export interface ChatCompletion {
  id: string;
  object: 'chat.completion';
  model: string;
  choices: ChatCompletionChoice[];
  usage?: Usage;
  created?: number;
}

/** 流式 delta 增量 */
export interface Delta {
  role?: 'assistant';
  content?: string | null;
  tool_calls?: ToolCallChunk[];
  annotations?: Annotation[];
}

export interface ChatCompletionChunkChoice {
  index: number;
  delta: Delta;
  finish_reason: FinishReason;
}

/** 流式 SSE 事件携带的 chunk */
export interface ChatCompletionChunk {
  id: string;
  object: 'chat.completion.chunk';
  model: string;
  choices: ChatCompletionChunkChoice[];
  usage?: Usage | null;
}

/** 知识库检索工具用量统计 */
export interface KnowledgeSearchUsage {
  /** 检索工具使用次数 */
  tool_usage: number;
  /** 命中的知识片段数量 */
  chunk_usage: number;
}

/** 仅含使用次数的工具用量统计 */
export interface ToolUsage {
  tool_usage: number;
}

/** Token 用量及蜀农工具用量扩展 */
export interface Usage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  agriwis_knowledge_search_usage?: KnowledgeSearchUsage;
  agriwis_weather_search_usage?: ToolUsage;
  agriwis_crop_growth_usage?: ToolUsage;
  agriwis_get_current_time_usage?: ToolUsage;
}

/** 知识库引用溯源标注 */
export interface KnowledgeCitation {
  type: 'knowledge_citation';
  /** 知识库条目 ID */
  kb_id: string;
  title: string;
  summary: string;
  /** 条目分类，如 crop（作物） */
  category: string;
  /**
   * 相关性分数，语义随检索模式变化：
   * 精排（rerank）为 0-1 精排相关度；混合检索（hybrid）为 RRF 分数（约 0.01~0.03，仅用于排序）；
   * 纯向量降级为 0-1 余弦相似度。不同模式间不可比较。
   */
  score: number;
}

/** 天气数据来源标注 */
export interface WeatherCitation {
  type: 'weather_citation';
  /** 天气数据提供方 */
  provider: string;
  location: string;
  /** 数据对应日期，如 2026-08-20 */
  date: string;
  summary: string;
  updated_at: string;
}

/** 响应中的引用标注（判别联合，以 type 字段区分） */
export type Annotation = KnowledgeCitation | WeatherCitation;
