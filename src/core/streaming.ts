/**
 * SSE（Server-Sent Events）流式响应封装。
 * 逐行增量解析 `data:` 事件，遇到 `data: [DONE]` 时终止，
 * 实现 AsyncIterable，可直接 `for await (const chunk of stream)` 消费。
 */
export class Stream<T> implements AsyncIterable<T> {
  readonly controller: AbortController;
  private readonly response: Response;

  constructor(response: Response, controller: AbortController) {
    this.response = response;
    this.controller = controller;
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return this.iterator();
  }

  private async *iterator(): AsyncGenerator<T> {
    if (!this.response.body) {
      return;
    }
    const reader = this.response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    /** 是否已收到 [DONE] 结束标记 */
    let terminated = false;

    const parseLine = (line: string): T | typeof DONE | null => {
      const trimmed = line.trim();
      // 忽略空行、注释与 event:/id:/retry: 等字段行
      if (!trimmed || trimmed.startsWith(':') || !trimmed.startsWith('data:')) {
        return null;
      }
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return DONE;
      if (!data) return null;
      try {
        return JSON.parse(data) as T;
      } catch {
        // 容忍无法解析的畸形事件
        return null;
      }
    };

    try {
      while (!terminated) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while (!terminated && (newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex).replace(/\r$/, '');
          buffer = buffer.slice(newlineIndex + 1);
          const parsed = parseLine(line);
          if (parsed === DONE) {
            terminated = true;
          } else if (parsed !== null) {
            yield parsed;
          }
        }
      }

      // 处理结尾没有换行符的残留数据
      if (!terminated && buffer.length > 0) {
        const parsed = parseLine(buffer);
        if (parsed === DONE) {
          // 结束
        } else if (parsed !== null) {
          yield parsed;
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

/** [DONE] 哨兵标记 */
const DONE = Symbol('done');
