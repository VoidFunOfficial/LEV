import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import * as projects from '../../src/app/api/projects/route.ts';
import * as context from '../../src/app/api/context/route.ts';
import * as agents from '../../src/app/api/agents/route.ts';
import * as models from '../../src/app/api/models/route.ts';
import * as run from '../../src/app/api/run/route.ts';
import * as thread from '../../src/app/api/threads/[id]/route.ts';
import * as wiki from '../../src/app/api/wiki/route.ts';
import * as imageSearch from '../../src/app/api/image-search/route.ts';
import * as streetRoute from '../../src/app/api/street-route/route.ts';
import { initializeProject } from './project.mjs';

// The app shell (Android or iOS) starts this file with LEARNEV_SESSION, LEARNEV_DATA_DIR,
// PI_CODING_AGENT_DIR and an optional LEARNEV_PORT, from a writable working directory.
const root = path.dirname(fileURLToPath(import.meta.url));
const web = path.join(root, 'www');
const token = process.env.LEARNEV_SESSION;
delete process.env.LEARNEV_SESSION;
if (!token || !/^[0-9a-f]{64}$/.test(token)) throw new Error('Missing app session');
process.env.LEARNEV_PROMPT_DIR = path.join(root, 'prompts');
process.env.LEARNEV_RENDER = 'off';
await initializeProject(path.join(root, 'seed'));
const routes = new Map(Object.entries({
  '/api/projects': projects, '/api/context': context, '/api/agents': agents, '/api/models': models,
  '/api/run': run, '/api/wiki': wiki, '/api/image-search': imageSearch, '/api/street-route': streetRoute,
}));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json', '.png': 'image/png', '.wasm': 'application/wasm' };
const server = createServer(async (incoming, outgoing) => {
  const end = code => { outgoing.writeHead(code); outgoing.end(); };
  const host = '127.0.0.1:' + server.address().port;
  if (incoming.headers.host !== host || !(incoming.headers.cookie || '').split(/;\s*/).includes('learnev=' + token)) return end(403);
  if (incoming.headers['sec-fetch-site'] === 'cross-site' || (incoming.headers.origin && incoming.headers.origin !== 'http://' + host)) return end(403);
  const abort = new AbortController();
  outgoing.on('close', () => { if (!outgoing.writableFinished) abort.abort(); });
  try {
    const url = new URL(incoming.url, 'http://' + host);
    if (url.host !== host) return end(403);
    const id = /^\/api\/threads\/([a-f0-9-]+)$/i.exec(url.pathname)?.[1];
    const route = id ? thread : routes.get(url.pathname);
    if (route) {
      const method = incoming.method;
      const handler = Object.hasOwn(route, method) && route[method];
      if (typeof handler !== 'function') return end(405);
      const request = new Request(url, { method, headers: incoming.headers, signal: abort.signal,
        ...(['GET','HEAD'].includes(method) ? {} : { body: Readable.toWeb(incoming), duplex: 'half' }) });
      const response = await handler(request, { params: Promise.resolve({ id }) });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.headers.get('content-type')?.startsWith('application/x-ndjson')) outgoing.flushHeaders();
      if (response.body) await pipeline(Readable.fromWeb(response.body), outgoing);
      else outgoing.end();
      return;
    }
    if (incoming.method !== 'GET' && incoming.method !== 'HEAD') return end(405);
    const file = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
    if (!(file === 'index.html' || file === 'icon.svg' || file.startsWith('_next/static/')) || file.split('/').some(p => !p || p.startsWith('.'))) return end(404);
    const source = path.join(web, file);
    if (!existsSync(source) || !(await stat(source)).isFile()) return end(404);
    outgoing.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream',
      'cache-control': file.startsWith('_next/static/') ? 'private, max-age=31536000, immutable' : 'no-store',
      'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY' });
    if (incoming.method === 'HEAD') outgoing.end();
    else await pipeline(createReadStream(source), outgoing);
  } catch (error) {
    if (outgoing.destroyed || abort.signal.aborted) return;
    if (!outgoing.headersSent) end(500);
    else outgoing.destroy();
    console.error('Mobile request failed:', error.name);
  }
});
const preferred = Number(process.env.LEARNEV_PORT || 0);
server.once('error', e => { if (e.code === 'EADDRINUSE' && preferred) server.listen(0, '127.0.0.1'); else throw e; });
server.on('listening', async () => {
  const port = server.address().port;
  console.log('LEARNEV_READY ' + port);
  // iOS runs Node inside the app process, where the shell cannot read this process's stdout.
  const ready = process.env.LEARNEV_READY_FILE;
  if (ready) {
    await writeFile(ready + '.tmp', String(port));
    await rename(ready + '.tmp', ready);
  }
});
server.listen(preferred, '127.0.0.1');
