// A real record must survive stopping the whole Codespace, not just a container.
const fs = require('node:fs');
process.loadEnvFile('.env');
const phase = process.argv[2];
const base = 'http://127.0.0.1:3006';
const checkpoint = 'restart-check.json';
async function request(method, route, body, token) {
  const response = await fetch(base + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`${method} ${route}: HTTP ${response.status}`);
  return response.status === 204 ? null : response.json();
}
async function main() {
  if (!['before', 'after'].includes(phase)) throw new Error('Use before or after.');
  const { access_token: token } = await request('POST', '/auth/login', {
    username: 'admin', password: process.env.DEMO_ADMIN_PASSWORD,
  });
  if (phase === 'before') {
    if (fs.existsSync(checkpoint)) throw new Error('A previous checkpoint exists; finish its after check first.');
    const task = await request('POST', '/tasks', { title: `Restart check ${Date.now()}`, description: 'Temporary lab19 verification record' }, token);
    fs.writeFileSync(checkpoint, JSON.stringify({ id: task.id, title: task.title }), { flag: 'wx' });
    console.log(`Checkpoint task ${task.id} created before stopping Codespace.`);
  } else {
    const saved = JSON.parse(fs.readFileSync(checkpoint, 'utf8'));
    const task = await request('GET', `/tasks/${saved.id}`, undefined, token);
    if (task.id !== saved.id || task.title !== saved.title) throw new Error('PostgreSQL checkpoint changed.');
    await request('DELETE', `/tasks/${saved.id}`, undefined, token);
    fs.unlinkSync(checkpoint);
    console.log(`PASS: task ${saved.id} survived a full Codespace stop/start. Temporary record removed.`);
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
