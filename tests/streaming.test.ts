import { describe, expect, it, vi } from 'vitest';
import Agriwis, { type ChatCompletionChunk } from '../src';

const encoder = new TextEncoder();

function sseResponse(sseText: string, chunkSize = 1 << 16): Response {
  const bytes = encoder.encode(sseText);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // 按固定大小切分字节块，模拟网络分包（可能切断一行中间）
      for (let i = 0; i < bytes.length; i += chunkSize) {
        controller.enqueue(bytes.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

const event = (delta: Record<string, unknown>, finish: string | null = null) =>
  `data: ${JSON.stringify({
    id: 'chatcmpl-1',
    object: 'chat.completion.chunk',
    model: 'auto',
    choices: [{ index: 0, delta, finish_reason: finish }],
  })}\n\n`;

describe('流式响应（SSE）', () => {
  it('逐段解析 chunk 并在 [DONE] 处终止', async () => {
    const sse =
      event({ role: 'assistant', content: '蜀农' }) +
      event({ content: '智能体' }) +
      event({}, 'stop') +
      'data: [DONE]\n\n';
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse));
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    const stream = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: '介绍蜀农 API' }],
      stream: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.choices[0]?.delta.content).toBe('蜀农');
    expect(chunks[1]?.choices[0]?.delta.content).toBe('智能体');
    expect(chunks[2]?.choices[0]?.finish_reason).toBe('stop');
  });

  it('容忍字节流中途切断行与空行、空 choices 事件', async () => {
    const sse =
      '\n' +
      event({ content: 'a' }) +
      'data: {"id":"c","object":"chat.completion.chunk","model":"auto","choices":[]}\n\n' +
      event({ content: 'b' }, 'stop') +
      'data: [DONE]\n\n';
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse, 7));
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    const stream = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });

    const contents: string[] = [];
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta.content;
      if (text) contents.push(text);
    }
    expect(contents.join('')).toBe('ab');
  });

  it('容忍畸形 JSON 事件不中断流', async () => {
    const sse =
      'data: {not-json}\n\n' + event({ content: 'ok' }, 'stop') + 'data: [DONE]\n\n';
    const fetchMock = vi.fn().mockResolvedValue(sseResponse(sse));
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    const stream = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of stream) chunks.push(chunk);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.choices[0]?.delta.content).toBe('ok');
  });
});
