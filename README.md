# agriwis-ai

蜀农 AI API 的 TypeScript SDK，架构与工程实践对齐 [openai-node](https://github.com/openai/openai-node)。

- OpenAI 兼容的 Chat Completions（`client.chat.completions.create`）
- 蜀农内置工具类型：知识库检索、天气搜索、生长周期识别、获取当前时间
- SSE 流式响应（`for await` 消费）、多模态图片（URL / Base64）
- 完整 TypeScript 类型与自动补全；零第三方运行时依赖（Node.js ≥ 18）
- 408/429/5xx 指数退避自动重试；类型化错误体系；超时与请求取消

## 安装

```bash
npm install agriwis-ai
```

要求 Node.js ≥ 18（依赖原生 `fetch` / `ReadableStream`）。

## 快速开始

```ts
import Agriwis from 'agriwis-ai';

const client = new Agriwis(); // 读取 AGRIWIS_API_KEY 环境变量

const completion = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '你好' }],
});

console.log(completion.choices[0]?.message.content);
```

## 客户端配置

```ts
const client = new Agriwis({
  apiKey: 'My API Key',                       // 默认按序读取 AGRIWIS_API_KEY、SHUNONG_API_KEY
  baseURL: 'https://ai.agriwis.com/v1',       // 默认值
  timeout: 60_000,                            // 单次请求超时（毫秒）
  maxRetries: 2,                              // 408/429/5xx 自动重试次数
  defaultHeaders: { 'x-app-id': 'demo' },     // 附加自定义请求头
  fetch: customFetch,                         // 自定义 fetch 实现（测试/代理）
});
```

> 安全提示：API Key 仅应在可信的后端环境使用。浏览器端请求会暴露密钥，建议由后端代理调用。

## 流式响应

```ts
const stream = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '写一段欢迎词。' }],
  stream: true,
});

for await (const chunk of stream) {
  const text = chunk.choices[0]?.delta.content; // 空 choices 为元数据事件，读取前需检查
  if (text) process.stdout.write(text);
}
```

## 工具调用（自定义 function）

```ts
const response = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '北京天气如何？' }],
  tools: [{
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取城市当前天气',
      parameters: {
        type: 'object',
        properties: { location: { type: 'string' } },
        required: ['location'],
      },
    },
  }],
  tool_choice: 'auto',
});

const toolCall = response.choices[0]?.message.tool_calls?.[0];
// 应用侧校验并执行函数，再将结果以 tool 消息追加后重新请求
```

## 蜀农内置工具

内置工具与自定义 function 一样通过 `tools` 参数声明，由模型自动判断是否调用：

```ts
// 知识库检索：回答附引用溯源（message.annotations）
await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '水稻分蘖期应该如何管理水层？' }],
  tools: [{
    type: 'agriwis_knowledge_search',
    query: '水稻分蘖期水分管理', // 必填
    top_k: 5,                    // 可选，默认 5，上限 20
    score_threshold: 0.7,        // 可选，相关度阈值，仅对向量/精排阶段生效
    use_rerank: true,            // 可选，重排序
  }],
  tool_choice: 'auto',
});

// 天气搜索：支持城市/区县/9 位编码，或 latitude + longitude 坐标
{ type: 'agriwis_weather_search', location: '武汉', date: 'forecast' }
{ type: 'agriwis_weather_search', latitude: 30.67, longitude: 104.07, province: '四川' }

// 生长周期识别（配合多模态图片输入）
{ type: 'agriwis_crop_growth', recognition_type: 'wheat_stage' }

// 获取当前时间；with_solar_terms 可返回整年二十四节气
{ type: 'agriwis_get_current_time', format: 'yyyy-MM-dd HH:mm:ss', timezone: 'Asia/Shanghai', with_solar_terms: true }
```

工具用量统计位于 `usage.agriwis_*_usage`（`tool_usage` / `chunk_usage`）。

## 多模态图片

```ts
messages: [{
  role: 'user',
  content: [
    { type: 'text', text: '请识别这株小麦当前所处的生育期。' },
    { type: 'image_url', image_url: { url: 'https://example.com/wheat-field.jpg' } },
    // 或 Base64: { url: 'data:image/png;base64,<BASE64_DATA>' }
  ],
}]
```

## 错误处理

SDK 已对 408/429/5xx 与网络连接错误自动指数退避重试（遵循 `retry-after` 头）；400/401/403/404 等应先修正请求，不会自动重试。

| 错误类 | 状态码 | 说明 |
| --- | --- | --- |
| `BadRequestError` | 400 | JSON 格式、参数类型或值不正确 |
| `AuthenticationError` | 401 | API Key 缺失、错误、过期或已撤销 |
| `PermissionDeniedError` | 403 | 无权使用指定模型或接口 |
| `NotFoundError` | 404 | Base URL、路径或模型名不正确 |
| `RequestTimeoutError` | 408 | 服务端处理超时（会自动重试） |
| `UnprocessableEntityError` | 413/422 | 请求内容过大 |
| `RateLimitError` | 429 | 频率限制或额度不足（会自动重试） |
| `InternalServerError` | 5xx | 服务端异常（会自动重试） |
| `APIConnectionError` / `APIConnectionTimeoutError` | — | 网络连接失败 / 超时 |
| `APIUserAbortError` | — | 请求被主动取消 |

```ts
import { AuthenticationError, RateLimitError } from 'agriwis-ai';

try {
  await client.chat.completions.create({ model: 'auto', messages: [] });
} catch (err) {
  if (err instanceof AuthenticationError) {
    console.error(err.status, err.error?.code, err.message); // 错误体 { message, type, code }
  } else if (err instanceof RateLimitError) {
    console.error('重试后仍超限');
  } else {
    throw err;
  }
}
```

请求取消：`create(body, { signal: controller.signal })`。

## 导出结构

```ts
import Agriwis, {                                    // 默认导出客户端类
  AuthenticationError, RateLimitError,               // 错误类
  type ChatCompletion, type ChatCompletionChunk,     // 响应类型
  type Message, type Tool, type Usage,               // 请求类型
  type KnowledgeSearchTool, type WeatherSearchTool,  // 内置工具类型
  Stream, APIPromise,                                // 流式与请求封装
} from 'agriwis-ai';
```

## 示例

`examples/` 目录包含可直接运行的完整示例：

| 文件 | 内容 |
| --- | --- |
| `basic.ts` | 非流式对话 |
| `streaming.ts` | SSE 流式对话 |
| `multimodal.ts` | 多模态图片（URL / Base64） |
| `tools-function.ts` | 自定义 function 工具调用回路 |
| `builtin-tools.ts` | 四种蜀农内置工具 |
| `error-handling.ts` | 类型化错误捕获与请求取消 |

```bash
npm install
npx tsx examples/basic.ts
```

## 开发

```bash
npm run test        # Vitest 测试
npm run typecheck   # 严格类型检查
npm run build       # ESM + CJS 双格式构建（dist/）
```
