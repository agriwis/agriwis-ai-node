import Agriwis from 'agriwis-ai';

const client = new Agriwis();

const weatherTool = {
  type: 'function',
  function: {
    name: 'get_weather',
    description: '获取城市当前天气',
    parameters: {
      type: 'object',
      properties: {
        location: { type: 'string', description: '城市名称' },
        unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
      },
      required: ['location'],
    },
  },
} as const;

// 声明工具后发起请求，模型可能在 tool_calls 中返回调用
const first = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '北京天气如何？' }],
  tools: [weatherTool],
  tool_choice: 'auto',
});

const toolCall = first.choices[0]?.message.tool_calls?.[0];
if (!toolCall) {
  console.log(first.choices[0]?.message.content);
  process.exit(0);
}

// 应用侧校验并执行函数（模型不会替你运行代码）
const args = JSON.parse(toolCall.function.arguments) as { location: string };
const result = { location: args.location, weather: '晴', temperature: '25°C' };

// 将 assistant 消息与 tool 结果追加到历史后再次请求
const final = await client.chat.completions.create({
  model: 'auto',
  tools: [weatherTool],
  messages: [
    { role: 'user', content: '北京天气如何？' },
    first.choices[0]!.message,
    { role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(result) },
  ],
});

console.log(final.choices[0]?.message.content);
