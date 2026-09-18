import { describe, expect, it, vi } from 'vitest';
import Agriwis, {
  APIConnectionTimeoutError,
  AuthenticationError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
} from '../src';
import { completionBody } from './completions.test';

const ok = () => new Response(JSON.stringify(completionBody), { status: 200 });

const createCall = (client: Agriwis) =>
  client.chat.completions.create({
    model: 'auto',
    messages: [{ role: 'user', content: '你好' }],
  });

describe('错误映射', () => {
  it('401 → AuthenticationError，携带 message/type/code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { message: 'Invalid API key', type: 'authentication_error', code: 'invalid_api_key' },
        }),
        { status: 401 },
      ),
    );
    const client = new Agriwis({ apiKey: 'bad', fetch: fetchMock });

    try {
      await createCall(client);
      expect.unreachable('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(AuthenticationError);
      const e = err as AuthenticationError;
      expect(e.message).toBe('Invalid API key');
      expect(e.status).toBe(401);
      expect(e.error?.code).toBe('invalid_api_key');
    }
  });

  it.each([
    [400, BadRequestError],
    [429, RateLimitError],
    [500, InternalServerError],
  ] as const)('%i → %j', async (status, ErrorClass) => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'boom' } }), { status }),
    );
    const client = new Agriwis({ apiKey: 'sk-test', maxRetries: 0, fetch: fetchMock });
    await expect(createCall(client)).rejects.toBeInstanceOf(ErrorClass);
  });
});

describe('重试策略', () => {
  it('429 重试后成功，并遵循 retry-after 头', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'rate limited' } }), {
          status: 429,
          headers: { 'retry-after': '0' },
        }),
      )
      .mockResolvedValueOnce(ok());
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    const completion = await createCall(client);
    expect(completion.choices[0]?.message.content).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('500 重试 maxRetries 次后抛出 InternalServerError', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'internal' } }), { status: 500 }),
    );
    const client = new Agriwis({ apiKey: 'sk-test', maxRetries: 2, fetch: fetchMock });

    await expect(createCall(client)).rejects.toBeInstanceOf(InternalServerError);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 首次 + 2 次重试
  });

  it('400 不重试', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 }),
    );
    const client = new Agriwis({ apiKey: 'sk-test', fetch: fetchMock });

    await expect(createCall(client)).rejects.toBeInstanceOf(BadRequestError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('请求超时抛出 APIConnectionTimeoutError', async () => {
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const client = new Agriwis({ apiKey: 'sk-test', maxRetries: 0, timeout: 30, fetch: fetchMock });

    await expect(createCall(client)).rejects.toBeInstanceOf(APIConnectionTimeoutError);
  });
});
