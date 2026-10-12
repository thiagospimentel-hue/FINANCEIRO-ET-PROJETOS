// Recalcula o hash do <script> do index.html e grava os cabeçalhos de segurança em vercel.json.
// Rodar SEMPRE depois de editar o index.html:   node tools/atualizar-csp.js
const fs = require('fs'), crypto = require('crypto');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
if (scripts.length !== 1) { console.error('Esperado exatamente 1 <script> inline; achei ' + scripts.length); process.exit(1); }
const hash = "'sha256-" + crypto.createHash('sha256').update(scripts[0][1], 'utf8').digest('base64') + "'";
const supa = (html.match(/SB_URL='(https:\/\/[^']+)'/) || [])[1];
if (!supa) { console.error('SB_URL não encontrado'); process.exit(1); }
const csp = [
  "default-src 'none'",
  "script-src " + hash,
  "style-src 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src data:",
  "connect-src " + supa,
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ');
const cfg = { headers: [{ source: '/(.*)', headers: [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'Cache-Control', value: 'no-cache' },
] }] };
fs.writeFileSync(__dirname + '/../vercel.json', JSON.stringify(cfg, null, 2) + '\n');
console.log('vercel.json atualizado com', hash);
