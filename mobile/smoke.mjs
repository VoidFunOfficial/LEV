// Starts the packed mobile runtime (mobile/build/runtime) with the desktop Node.js the way the
// app shells do. Checks the session gate, the UI, the API routes and one full chat turn against a
// local OpenAI-compatible fixture model.
// Usage: node mobile/smoke.mjs   (after node mobile/prepare-runtime.mjs <android|ios>)
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const runtime = path.join(path.dirname(fileURLToPath(import.meta.url)), 'build/runtime');
assert.ok(existsSync(path.join(runtime, 'server.mjs')), 'Run node mobile/prepare-runtime.mjs first.');
const answer = 'Hello from the fixture model.';

// The opening request gets one short sentence; the main request answers and calls end.
const fixture = createServer(async (req, res) => {
  let body = '';
  for await (const part of req) body += part;
  const opening = body.includes('Write only the opening of a shared answer');
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  const chunk = (delta, finish = null) => res.write('data: ' + JSON.stringify({ id: 'fixture', object: 'chat.completion.chunk',
    created: 1, model: 'fixture', choices: [{ index: 0, delta, finish_reason: finish }] }) + '\n\n');
  if (opening) {
    chunk({ role: 'assistant', content: 'In short:' });
    chunk({}, 'stop');
  } else {
    chunk({ role: 'assistant', content: answer });
    chunk({ tool_calls: [{ index: 0, id: 'call_end', type: 'function', function: { name: 'end', arguments: '{}' } }] });
    chunk({}, 'tool_calls');
  }
  res.end('data: [DONE]\n\n');
});
await new Promise(resolve => fixture.listen(0, '127.0.0.1', resolve));

const home = mkdtempSync(path.join(tmpdir(), 'learnev-mobile-'));
mkdirSync(path.join(home, 'agent'));
writeFileSync(path.join(home, 'agent/models.json'), JSON.stringify({ providers: { fixture: {
  api: 'openai-completions', baseUrl: `http://127.0.0.1:${fixture.address().port}/v1`, apiKey: 'test-only',
  models: [{ id: 'fixture', reasoning: false }] } } }));
const token = randomBytes(32).toString('hex');
const child = spawn(process.execPath, [path.join(runtime, 'server.mjs')], {
  cwd: home,
  env: { ...process.env, LEARNEV_SESSION: token, LEARNEV_DATA_DIR: path.join(home, 'state'),
    PI_CODING_AGENT_DIR: path.join(home, 'pi'), LEARNEV_READY_FILE: path.join(home, 'ready') },
  stdio: ['ignore', 'pipe', 'inherit'],
});
try {
  const port = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('The runtime did not start in 60 s:\n' + out)), 60_000);
    child.on('exit', code => reject(new Error(`The runtime exited with ${code}:\n${out}`)));
    child.stdout.on('data', chunk => {
      out += chunk;
      const match = /LEARNEV_READY (\d+)/.exec(out);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
  });
  const origin = `http://127.0.0.1:${port}`;
  const request = (p, init = {}) => fetch(origin + p, { ...init, headers: { cookie: 'learnev=' + token,
    ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers } });
  const send = (p, method, body) => request(p, { method, body: JSON.stringify(body) });

  assert.equal((await fetch(origin + '/')).status, 403, 'requests without the session cookie are refused');
  const page = await request('/');
  assert.equal(page.status, 200);
  const script = /src="(\/_next\/static\/[^"]+\.js)"/.exec(await page.text())?.[1];
  assert.ok(script, 'index.html references the built scripts');
  assert.equal((await request(script)).status, 200, script);
  assert.equal((await request('/render')).status, 404, 'the render page is not served');

  const created = await send('/api/projects', 'POST', { name: 'Smoke' });
  assert.equal(created.status, 201, await created.clone().text());
  const projectId = (await created.json()).id;
  const listing = await request('/api/projects?projectId=' + projectId);
  assert.equal(listing.status, 200, await listing.clone().text());
  const { agents } = await listing.json();
  assert.deepEqual(agents.map(a => a.id).sort(), ['tutor', 'workspace'], 'both preset agents are seeded');
  for (const agent of agents) assert.ok(!agent.tools.includes('render2img'), agent.id + ' leaves render2img out');
  const models = await request('/api/models');
  assert.equal(models.status, 200, await models.clone().text());

  const agent = await send('/api/agents', 'POST', { id: 'smoke', name: 'Smoke', provider: 'fixture', model: 'fixture',
    thinkingLevel: 'off', output: 'markdown', instructions: 'Answer briefly.' });
  assert.equal(agent.status, 201, await agent.clone().text());
  const threadId = randomUUID();
  const turn = await send('/api/run', 'POST', { projectId, threadId, turnId: randomUUID(), agentId: 'smoke', text: 'Say hello.' });
  assert.equal(turn.status, 200, await turn.clone().text());
  const events = (await turn.text()).trim().split('\n').map(line => JSON.parse(line));
  const last = events.at(-1);
  assert.equal(last.type, 'end');
  assert.equal(last.turn.status, 'done', last.turn.error);
  assert.ok(last.turn.content.includes(answer), last.turn.content);
  const saved = await (await request(`/api/threads/${threadId}?projectId=${projectId}`)).json();
  assert.ok(JSON.stringify(saved).includes(answer), 'the turn is saved in the thread');

  for (let i = 0; i < 50 && !existsSync(path.join(home, 'ready')); i++) await new Promise(r => setTimeout(r, 100));
  assert.ok(existsSync(path.join(home, 'ready')), 'the ready file is written');
  console.log(`mobile runtime ok on ${origin}: UI, session gate, projects, agents, models and a full turn`);
} finally {
  child.kill();
  fixture.close();
  rmSync(home, { recursive: true, force: true, maxRetries: 5 });
}
