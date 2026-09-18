import { readFileSync } from 'node:fs';
import Agriwis from 'agriwis-ai';

const client = new Agriwis();

// 方式一：图片 URL
const byUrl = await client.chat.completions.create({
  model: 'auto',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '请描述这张图片。' },
        { type: 'image_url', image_url: { url: 'https://example.com/photo.jpg' } },
      ],
    },
  ],
});
console.log(byUrl.choices[0]?.message.content);

// 方式二：Base64 Data URL
const imageBase64 = readFileSync('./photo.png').toString('base64');
const byBase64 = await client.chat.completions.create({
  model: 'auto',
  messages: [
    {
      role: 'user',
      content: [
        { type: 'text', text: '图片里有什么？' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${imageBase64}` } },
      ],
    },
  ],
});
console.log(byBase64.choices[0]?.message.content);
