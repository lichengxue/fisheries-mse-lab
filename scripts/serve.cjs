'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '..', 'index.html');
const port = Number(process.env.PORT || 8000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('PORT must be 1–65535.');
if (!fs.existsSync(file)) throw Error('Run npm run build first.');
const server = http.createServer((req, res) => {
  const route = new URL(req.url, 'http://localhost').pathname;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, {'Allow': 'GET, HEAD'}); res.end(); return;
  }
  if (route !== '/' && route !== '/index.html') {
    res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'}); res.end('Not found'); return;
  }
  res.writeHead(200, {'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store'});
  if (req.method === 'HEAD') res.end();
  else fs.createReadStream(file).pipe(res);
});
server.listen(port, '127.0.0.1', () => console.log('MSE GUI: http://127.0.0.1:' + port));
server.on('error', error => { console.error(error.message); process.exitCode = 1; });
