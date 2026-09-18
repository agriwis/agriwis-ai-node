import Agriwis from 'agriwis-ai';

const client = new Agriwis(); // 默认读取 AGRIWIS_API_KEY 环境变量

const completion = await client.chat.completions.create({
  model: 'auto',
  messages: [
    { role: 'system', content: '你是一个简洁的助手。' },
    { role: 'user', content: '什么是 API？' },
  ],
  temperature: 0.7,
  max_tokens: 256,
});

console.log(completion.choices[0]?.message.content);
console.log('Token 用量:', completion.usage);
