import Agriwis from 'agriwis-ai';

const client = new Agriwis();

const stream = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '写一段欢迎词。' }],
  stream: true,
});

let full = '';
for await (const chunk of stream) {
  // 流式事件可能为空 choices（元数据事件），读取前需检查
  const text = chunk.choices[0]?.delta.content;
  if (text) {
    full += text;
    process.stdout.write(text);
  }
}
process.stdout.write('\n');
console.log('完整内容:', full);
