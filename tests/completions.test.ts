import { describe, expect, it, vi } from 'vitest';
import Agriwis, { type ChatCompletion } from '../src';

export const completionBody: ChatCompletion = {
  id: 'chatcmpl-1',
  object: 'chat.completion',
  model: 'auto',
  choices: [
    {
      index: 0,
      finish_reason: 'stop',
      message: { role: 'assistant', content: 'API 是应用程序编程接口。', tool_calls: null },
    },
  ],
  usage: { prompt_tokens: 12, completion_tokens: 10, total_tokens: 22 },
};

describe('chat.completions.create（非流式）', () => {
  it('发送 POST 请求并解析响应', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(completionBody), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    const completion = await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: '什么是 API？' }],
    });

    expect(completion.choices[0]?.message.content).toBe('API 是应用程序编程接口。');
    expect(completion.usage?.total_tokens).toBe(22);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://ai.agriwis.com/api/v1/chat/completions');
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer sk-test');
    expect(headers['content-type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('auto');
    expect(body.messages).toEqual([{ role: 'user', content: '什么是 API？' }]);
  });

  it('透传全部请求参数（temperature / max_tokens / stop / tools / tool_choice）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(completionBody), { status: 200 }),
    );
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: '北京天气如何？' }],
      temperature: 0.7,
      max_tokens: 1024,
      stop: ['END'],
      tools: [
        { type: 'agriwis_weather_search', location: '北京', date: 'now' },
        {
          type: 'function',
          function: {
            name: 'get_weather',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ],
      tool_choice: 'auto',
    });

    const body = JSON.parse((fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.temperature).toBe(0.7);
    expect(body.max_tokens).toBe(1024);
    expect(body.stop).toEqual(['END']);
    expect(body.tools[0].type).toBe('agriwis_weather_search');
    expect(body.tool_choice).toBe('auto');
  });

  it('合并自定义请求头与环境变量密钥回退', async () => {
    process.env.AGRIWIS_API_KEY = 'sk-env';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(completionBody), { status: 200 }),
    );
    const client = new Agriwis({ defaultHeaders: { 'x-app-id': 'demo' }, fetch: fetchMock });
    await client.chat.completions.create({
      model: 'auto',
      messages: [{ role: 'user', content: '你好' }],
    });
    const headers = (fetchMock.mock.calls[0] as [string, RequestInit])[1]
      .headers as Record<string, string>;
    expect(headers['authorization']).toBe('Bearer sk-env');
    expect(headers['x-app-id']).toBe('demo');
    delete process.env.AGRIWIS_API_KEY;
  });

  it('缺少 API Key 时抛出 AgriwisError', () => {
    const saved = process.env.AGRIWIS_API_KEY;
    delete process.env.AGRIWIS_API_KEY;
    delete process.env.SHUNONG_API_KEY;
    expect(() => new Agriwis()).toThrow(/缺少 API Key/);
    if (saved) process.env.AGRIWIS_API_KEY = saved;
  });
});
