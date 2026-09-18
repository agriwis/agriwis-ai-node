import Agriwis from 'agriwis-ai';

const client = new Agriwis();

// 1. 知识库检索：农业专业知识问答，回答附引用溯源
const knowledge = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '水稻分蘖期应该如何管理水层？' }],
  tools: [
    { type: 'agriwis_knowledge_search', query: '水稻分蘖期水分管理', top_k: 5, use_rerank: true },
  ],
  tool_choice: 'auto',
});
console.log(knowledge.choices[0]?.message.content);
for (const a of knowledge.choices[0]?.message.annotations ?? []) {
  if (a.type === 'knowledge_citation') console.log(`引用: [${a.score}] ${a.title} (${a.kb_id})`);
}
console.log('工具用量:', knowledge.usage?.agriwis_knowledge_search_usage);

// 2. 天气搜索：实时天气 / 7 日预报
const weather = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '武汉明天天气怎么样？' }],
  tools: [{ type: 'agriwis_weather_search', location: '武汉', date: 'forecast' }],
  tool_choice: 'auto',
});
console.log(weather.choices[0]?.message.content);

// 3. 生长周期识别：需配合多模态图片输入
const growth = await client.chat.completions.create({
  model: 'auto',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请识别这株小麦当前所处的生育期。' },
        { type: 'image_url', image_url: { url: 'https://example.com/wheat-field.jpg' } },
      ],
    },
  ],
  tools: [{ type: 'agriwis_crop_growth', recognition_type: 'wheat_stage', stage_detail: true }],
  tool_choice: 'auto',
});
console.log(growth.choices[0]?.message.content);

// 4. 获取当前时间：支持 IANA 时区与自定义格式
const time = await client.chat.completions.create({
  model: 'auto',
  messages: [{ role: 'user', content: '现在几点？' }],
  tools: [
    { type: 'agriwis_get_current_time', format: 'yyyy-MM-dd HH:mm:ss', timezone: 'Asia/Shanghai' },
  ],
  tool_choice: 'auto',
});
console.log(time.choices[0]?.message.content);
