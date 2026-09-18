// 为 ESM 构建产物写入 {"type": "module"}，避免双格式构建时 .js 被当作 CJS 解析。
const fs = require('node:fs');
const path = require('node:path');

const target = path.join(__dirname, '..', 'dist', 'esm', 'package.json');
fs.writeFileSync(target, JSON.stringify({ type: 'module' }, null, 2) + '\n');
