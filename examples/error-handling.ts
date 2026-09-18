import Agriwis, {
  APIConnectionTimeoutError,
  AuthenticationError,
  RateLimitError,
} from 'agriwis-ai';

const client = new Agriwis({
  apiKey: process.env.AGRIWIS_API_KEY,
  timeout: 30_000,
  maxRetries: 2,
});

try {
  const completion = await client.chat.completions.create({
    model: 'auto',
    messages: [{ role: 'user', content: '你好' }],
  });
  console.log(completion.choices[0]?.message.content);
} catch (err) {
  if (err instanceof AuthenticationError) {
    // 401：API Key 缺失、错误、过期或已撤销；先修正请求，不要重复发送
    console.error('鉴权失败:', err.error?.code, err.message);
  } else if (err instanceof RateLimitError) {
    // 429：SDK 已按 retry-after 指数退避自动重试，仍失败说明额度/频率持续超限
    console.error('请求过多:', err.message);
  } else if (err instanceof APIConnectionTimeoutError) {
    console.error('请求超时:', err.message);
  } else {
    throw err;
  }
}

// 可通过 AbortSignal 主动取消请求
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);
try {
  await client.chat.completions.create(
    { model: 'auto', messages: [{ role: 'user', content: '长任务' }] },
    { signal: controller.signal },
  );
} catch {
  console.log('请求已取消');
}
