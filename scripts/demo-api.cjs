process.loadEnvFile('.env');
const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const base = `http://127.0.0.1:${process.env.APP_PORT || 3006}`;
const terminal = process.argv.includes('--steps') ? readline.createInterface({ input: stdin, output: stdout }) : null;
const suffix = Date.now().toString(36);
let adminToken;
let userId;
let taskId;

async function step(title) {
  console.log('\n' + title);
  if (terminal) await terminal.question('Нажмите Enter, чтобы выполнить этот пункт... ');
}

async function request(method, route, expected, body, token) {
  const response = await fetch(base + route, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  console.log(`${method} ${route} -> ${response.status} (ожидается ${expected})`);
  if (data) {
    const display = data.access_token ? { ...data, access_token: data.access_token.slice(0, 45) + '... [сокращён на экране]' } : data;
    console.log(JSON.stringify(display, null, 2));
  }
  if (response.status !== expected) throw new Error(`Неожиданный ответ ${response.status}`);
  return data;
}

async function main() {
  console.log('ЛР 19. Приложение работает в Docker. Регистрация, Passport Local, JWT и роли. Сервер: ' + base);
  const credentials = { username: `demo_${suffix}`, email: `demo_${suffix}@example.com`, password: 'Demo12345!' };
  // Администратор нужен только для финального показа ролей и уборки созданных данных.
  const admin = await fetch(base + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: process.env.DEMO_ADMIN_PASSWORD }),
    signal: AbortSignal.timeout(10000),
  });
  if (!admin.ok) throw new Error('Не удалось войти учебным администратором. Проверьте .env и npm run seed.');
  adminToken = (await admin.json()).access_token;

  await step('Проверка API: POST /auth/register — регистрация пользователя');
  const user = await request('POST', '/auth/register', 201, credentials);
  userId = user.id;
  console.log('Пароль и его хеш отсутствуют в ответе. Новому пользователю назначена роль user.');

  await step('Проверка API: POST /auth/login — неверный пароль');
  await request('POST', '/auth/login', 401, { username: credentials.username, password: 'Wrong123!' });

  await step('Проверка API: POST /auth/login — правильный пароль, выдача JWT');
  const login = await request('POST', '/auth/login', 200, credentials);
  const token = login.access_token;
  console.log('Payload (декодирование, без проверки подписи):');
  console.log(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')));

  await step('Проверка API: GET /tasks без JWT — доступ закрыт');
  await request('GET', '/tasks', 401);

  await step('Проверка API: GET /tasks с Authorization: Bearer <JWT> — доступ открыт');
  await request('GET', '/tasks', 200, undefined, token);
  await request('GET', '/auth/profile', 200, undefined, token);
  const task = await request('POST', '/tasks', 201, { title: 'Показ лабораторной 19', description: 'Задача создана после входа' }, token);
  taskId = task.id;

  await step('Проверка API: Пользователь user обращается к административному маршруту — 403');
  await request('DELETE', `/tasks/${taskId}`, 403, undefined, token);
  await request('GET', '/users', 403, undefined, token);

  await step('Проверка API: Администратор имеет две роли и доступ к пользователям');
  await request('GET', '/auth/profile', 200, undefined, adminToken);
  await request('GET', `/users/${userId}`, 200, undefined, adminToken);

  await step('Проверка API: Связь многие-ко-многим: назначение и отзыв второй роли');
  await request('PUT', `/users/${userId}/roles`, 200, { roles: ['user', 'administrator'] }, adminToken);
  await request('GET', `/users/${userId}`, 200, undefined, token);
  await request('PUT', `/users/${userId}/roles`, 200, { roles: ['user'] }, adminToken);
  await request('GET', '/users', 403, undefined, token);
  console.log('JWT не менялся. Актуальные роли считываются из базы при каждом запросе.');

  await step('Проверка API: Администратор удаляет демонстрационную задачу — 204');
  await request('DELETE', `/tasks/${taskId}`, 204, undefined, adminToken);
  taskId = undefined;
  console.log('\nВсе пункты демонстрации выполнены.');
}

main().catch((error) => { console.error(error.message, '\nДля запуска сервера: npm.cmd start'); process.exitCode = 1; })
  .finally(async () => {
    terminal?.close();
    if (adminToken) {
      if (taskId) await request('DELETE', `/tasks/${taskId}`, 204, undefined, adminToken).catch(() => {});
      if (userId) await request('DELETE', `/users/${userId}`, 204, undefined, adminToken).catch(() => {});
    }
  });
