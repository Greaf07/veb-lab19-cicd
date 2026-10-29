const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createHmac } = require('node:crypto');
const root = path.resolve(__dirname, '..');
process.chdir(root);
require('./config.cjs');
process.loadEnvFile('.env');
const output = path.join(root, 'verification');
fs.mkdirSync(output, { recursive: true });
let base = `http://127.0.0.1:${process.env.APP_PORT || 3006}`;
const normalBase = base;
const checks = [];
const users = [];
const tasks = [];
const suffix = Date.now().toString(36);
let adminToken;
let portContainer;
let serverLog = '';

function check(name, condition) {
  assert.ok(condition, name);
  checks.push(name);
  console.log('PASS ' + name);
}

function docker(args) {
  return execFileSync('docker', args, { cwd: root, encoding: 'utf8', windowsHide: true,
    maxBuffer: 20 * 1024 * 1024, timeout: 240000, stdio: ['pipe', 'pipe', 'pipe'] });
}

function inApi(code) {
  return JSON.parse(docker(['compose', 'exec', '-T', 'api', 'node', '-e', code]));
}

function saveLogs() {
  serverLog += docker(['compose', 'logs', '--no-color', '--no-log-prefix', 'api']);
}

function noPassword(data) {
  if (!data || typeof data !== 'object') return true;
  return Object.entries(data).every(([key, value]) =>
    !['password', 'passwordHash'].includes(key) && noPassword(value));
}

async function request(name, method, route, status, body, token) {
  const response = await fetch(base + route, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.equal(response.status, status, `${name}: ${text}`);
  assert.ok(noPassword(data), `${name}: утечка пароля или хеша`);
  checks.push(`${name}: HTTP ${status}, пароль и хеш не раскрыты`);
  console.log(`PASS ${name} -> ${status}`);
  return data;
}

async function ready(url) {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url + '/health', { signal: AbortSignal.timeout(1500) });
      if (response.ok && (await response.json()).database === 'connected') return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('API не подключилось к PostgreSQL: ' + url);
}

function signTestToken(claims, options) {
  const now = Math.floor(Date.now()/1000);
  const algorithm = options.algorithm || 'HS256';
  const header = Buffer.from(JSON.stringify({ alg: algorithm, typ: 'JWT' })).toString('base64url');
  const payload = { iat: now, exp: now + (options.expiresIn ?? 60), iss: options.issuer || 'lab19',
    aud: options.audience || 'lab19-api', ...claims };
  if (options.notBefore) payload.nbf = now + options.notBefore;
  const content = header + '.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
  return content + '.' + createHmac(algorithm === 'HS384' ? 'sha384' : 'sha256', options.secret || process.env.JWT_SECRET)
    .update(content).digest('base64url');
}

async function prepareContainers() {
  check('Docker Engine работает с Linux-контейнерами', docker(['info','--format','{{.OSType}}']).trim() === 'linux');
  const optimized = JSON.parse(docker(['image','inspect','veb-lab19:optimized']))[0];
  check('Production запускает node dist/main.js', JSON.stringify(optimized.Config.Cmd) === '["node","dist/main.js"]');
  docker(['compose', 'up', '-d', '--no-build', '--wait', '--wait-timeout', '180']);
  await ready(base);
  const ids = docker(['compose', 'ps', '-q']).trim().split(/\r?\n/);
  const containers = JSON.parse(docker(['inspect', ...ids]));
  check('Compose запустил два здоровых контейнера', containers.length === 2 && containers.every(c => c.State.Health.Status === 'healthy'));
  const api = containers.find(c => c.Config.Labels['com.docker.compose.service'] === 'api');
  check('Compose проверяет именно собранный образ', api.Image === optimized.Id);
  check('PostgreSQL хранит данные в именованном томе', containers.some(c => c.Mounts.some(m => m.Type === 'volume' && m.Destination === '/var/lib/postgresql/data')));
  const health = await request('API подключён к PostgreSQL', 'GET', '/health', 200);
  check('Health сообщает ожидаемую версию сборки', health.version === (process.env.EXPECTED_VERSION || 'local'));

  // Проверяем настоящий запуск на порту, назначенном через окружение.
  const network = Object.keys(api.NetworkSettings.Networks)[0];
  portContainer = docker(['run','-d','--network',network,
    '--env-file','.env','-e','HOST=0.0.0.0','-e','PORT=31919','-e','DB_HOST=db',
    '-p','127.0.0.1:31019:31919','veb-lab19:optimized']).trim();
  base = 'http://127.0.0.1:31019';
  await ready(base);
  await request('Приложение слушает назначенный PORT=31919', 'GET', '/health', 200);
  await request('На новом порту сохраняется защита JWT', 'GET', '/tasks', 401);
  docker(['stop',portContainer]);
  docker(['rm',portContainer]);
  portContainer = undefined;
  base = normalBase;
  const runtime = inApi(`const fs=require('fs');console.log(JSON.stringify({uid:process.getuid(),
    files:fs.readdirSync('/app'),src:fs.existsSync('/app/src'),env:fs.existsSync('/app/.env'),
    cli:fs.existsSync('/app/node_modules/@nestjs/cli'),ts:fs.existsSync('/app/node_modules/typescript'),
    bcrypt:typeof require('bcrypt').hash==='function',host:process.env.DB_HOST}));`);
  check('В production только dist и node_modules', JSON.stringify(runtime.files.sort()) === '["dist","node_modules"]');
  check('Исходники и .env отсутствуют в production', !runtime.src && !runtime.env);
  check('TypeScript и Nest CLI отсутствуют в production', !runtime.cli && !runtime.ts);
  check('Приложение запущено непривилегированным пользователем', runtime.uid === 1000);
  check('Нативный bcrypt работает в Linux-образе', runtime.bcrypt);
  check('БД доступна приложению по DNS-имени сервиса db', runtime.host === 'db');
  const history = docker(['history','--no-trunc','--format','{{.CreatedBy}}','veb-lab19:optimized']);
  check('JWT_SECRET и пароль БД не встроены в историю образа', !history.includes(process.env.JWT_SECRET) && !history.includes(process.env.POSTGRES_PASSWORD));
}

async function main() {
  await prepareContainers();
  const admin = await request('Вход администратора', 'POST', '/auth/login', 200,
    { username: 'admin', password: process.env.DEMO_ADMIN_PASSWORD });
  adminToken = admin.access_token;
  check('У администратора обе роли', ['user', 'administrator'].every((role) => admin.user.roles.includes(role)));
  const password = 'Lab17-Test123!';
  const a = { username: `test_a_${suffix}`, email: `a_${suffix}@example.com`, password };
  const b = { username: `test_b_${suffix}`, email: `b_${suffix}@example.com`, password };

  await request('Обязательные данные регистрации', 'POST', '/auth/register', 400, {});
  await request('Невалидный email', 'POST', '/auth/register', 400, { ...a, email: 'wrong' });
  await request('Короткий пароль', 'POST', '/auth/register', 400, { ...a, password: '123' });
  await request('Пустое имя', 'POST', '/auth/register', 400, { ...a, username: '   ' });
  await request('Пароль из пробелов', 'POST', '/auth/register', 400, { ...a, password: '        ' });
  await request('Пароль не строка', 'POST', '/auth/register', 400, { ...a, password: 12345678 });
  await request('Лимит bcrypt 72 байта UTF-8', 'POST', '/auth/register', 400, { ...a, password: 'я'.repeat(37) });
  await request('Нельзя назначить себе administrator при регистрации', 'POST', '/auth/register', 400,
    { ...a, roles: ['administrator'] });
  await request('Нельзя передать готовый passwordHash', 'POST', '/auth/register', 400, { ...a, passwordHash: 'fake' });
  await request('Нельзя обойти регистрацию через POST /users', 'POST', '/users', 404, a);

  const userA = await request('Регистрация A', 'POST', '/auth/register', 201, a); users.push(userA.id);
  const userB = await request('Регистрация B с тем же паролем', 'POST', '/auth/register', 201, b); users.push(userB.id);
  check('Регистрация назначает только user', JSON.stringify(userA.roles) === '["user"]');
  await request('Уникальность username', 'POST', '/auth/register', 409, { ...a, email: `other_${a.email}` });
  await request('Уникальность email', 'POST', '/auth/register', 409, { ...a, username: `other_${a.username}` });
  await request('Неверный пароль', 'POST', '/auth/login', 401, { username: a.username, password: 'Wrong123!' });
  await request('Несуществующий пользователь', 'POST', '/auth/login', 401, { username: `missing_${suffix}`, password });
  await request('Нет credentials', 'POST', '/auth/login', 401, {});
  await request('Нестроковые credentials', 'POST', '/auth/login', 401, { username: [a.username], password: 12345678 });
  const loginA = await request('Passport Local: вход A', 'POST', '/auth/login', 200, a);
  const loginB = await request('Passport Local: вход B', 'POST', '/auth/login', 200, b);
  const tokenA = loginA.access_token;
  const tokenB = loginB.access_token;
  check('JWT состоит из трёх частей', tokenA.split('.').length === 3);
  const payload = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64url').toString('utf8'));
  check('JWT содержит sub, issuer, audience и срок 3600 секунд', payload.sub === userA.id && payload.iss === 'lab19' && payload.aud === 'lab19-api' && payload.exp - payload.iat === 3600);
  check('JWT не содержит пароль, хеш или доверенные роли', noPassword(payload) && !('roles' in payload));
  await request('Профиль без токена', 'GET', '/auth/profile', 401);
  const profile = await request('Профиль с JWT', 'GET', '/auth/profile', 200, undefined, tokenA);
  check('Профиль соответствует JWT sub', profile.id === userA.id);

  for (const [method, route, body] of [['GET', '/tasks'], ['POST', '/tasks', { title: 'x' }], ['PATCH', '/tasks/1', { title: 'x' }], ['DELETE', '/tasks/1'], ['GET', '/users']]) {
    await request(`Защита без JWT: ${method} ${route}`, method, route, 401, body);
  }
  await request('Повреждённый JWT', 'GET', '/tasks', 401, undefined, 'bad.token.here');
  const changedPayload = Buffer.from(JSON.stringify({ ...payload, sub: admin.user.id })).toString('base64url');
  const tampered = tokenA.split('.'); tampered[1] = changedPayload;
  await request('Подмена sub без новой подписи', 'GET', '/tasks', 401, undefined, tampered.join('.'));
  const makeToken = (claims, extra = {}) => signTestToken({ sub: userA.id, ...claims }, extra);
  await request('Истёкший JWT', 'GET', '/tasks', 401, undefined, makeToken({}, { expiresIn: -1 }));
  await request('Неверная подпись JWT', 'GET', '/tasks', 401, undefined, makeToken({}, { secret: 'another-random-secret-for-test-only' }));
  await request('Другой алгоритм JWT', 'GET', '/tasks', 401, undefined, makeToken({}, { algorithm: 'HS384' }));
  await request('Неверный issuer', 'GET', '/tasks', 401, undefined, makeToken({}, { issuer: 'another-app' }));
  await request('Неверный audience', 'GET', '/tasks', 401, undefined, makeToken({}, { audience: 'another-api' }));
  await request('JWT ещё не действует', 'GET', '/tasks', 401, undefined, makeToken({}, { notBefore: 60 }));
  await request('Некорректный sub', 'GET', '/tasks', 401, undefined, makeToken({ sub: 'wrong' }));
  await request('Удалённый или отсутствующий пользователь', 'GET', '/tasks', 401, undefined, makeToken({ sub: 2147483647 }));
  await request('Обычный пользователь не читает /users', 'GET', '/users', 403, undefined, tokenA);
  await request('Администратор читает /users', 'GET', '/users', 200, undefined, adminToken);
  await request('Обычный пользователь не изменяет роли', 'PUT', `/users/${userA.id}/roles`, 403, { roles: ['administrator'] }, tokenA);
  await request('Запрет неизвестной роли', 'PUT', `/users/${userA.id}/roles`, 400, { roles: ['owner'] }, adminToken);
  await request('Запрет пустого набора ролей', 'PUT', `/users/${userA.id}/roles`, 400, { roles: [] }, adminToken);
  await request('Запрет дублирующихся ролей', 'PUT', `/users/${userA.id}/roles`, 400, { roles: ['user', 'user'] }, adminToken);
  await request('Администратор назначает две роли', 'PUT', `/users/${userA.id}/roles`, 200, { roles: ['user', 'administrator'] }, adminToken);
  await request('Новая роль работает с прежним JWT', 'GET', '/users', 200, undefined, tokenA);

  const stored = inApi(`
    const { Client } = require('pg');
    const bcrypt = require('bcrypt');
    const db = new Client({host:process.env.DB_HOST,port:5432,user:process.env.POSTGRES_USER,
      password:process.env.POSTGRES_PASSWORD,database:process.env.POSTGRES_DB});
    (async()=>{ await db.connect();
      const hashes=(await db.query('SELECT id, "passwordHash" FROM users WHERE id = ANY($1::int[]) ORDER BY id',
        [[${userA.id},${userB.id}]])).rows;
      const roles=(await db.query('SELECT r.name FROM roles r JOIN user_roles ur ON ur."rolesId"=r.id WHERE ur."usersId"=$1 ORDER BY r.name', [${userA.id}])).rows;
      console.log(JSON.stringify({hashCount:hashes.length,bcrypt:hashes.every(r=>r.passwordHash.startsWith('$2b$10$')),
        different:hashes[0].passwordHash!==hashes[1].passwordHash,
        correct:(await Promise.all(hashes.map(r=>bcrypt.compare(${JSON.stringify(password)},r.passwordHash)))).every(Boolean),
        roles:roles.map(r=>r.name)}));
      await db.end();
    })().catch(e=>{console.error(e.message);process.exitCode=1;});
  `);
  check('В PostgreSQL-контейнере хранятся bcrypt-хеши с cost=10', stored.hashCount === 2 && stored.bcrypt);
  check('Одинаковые пароли имеют разные соли и хеши', stored.different);
  check('bcrypt.compare подтверждает пароль обеих записей', stored.correct);
  check('ManyToMany записала две связи в user_roles', JSON.stringify(stored.roles) === '["administrator","user"]');
  await request('Отзыв роли administrator', 'PUT', `/users/${userA.id}/roles`, 200, { roles: ['user'] }, adminToken);
  await request('Отзыв роли действует сразу со старым JWT', 'GET', '/users', 403, undefined, tokenA);

  await request('Нельзя создать задачу другому пользователю', 'POST', '/tasks', 403, { title: 'x', userId: userB.id }, tokenA);
  await request('Нельзя самому создать административную задачу', 'POST', '/tasks', 403, { title: 'x', requiredRole: 'administrator' }, tokenA);
  await request('Валидация title', 'POST', '/tasks', 400, { title: ' ' }, tokenA);
  await request('Валидация userId', 'POST', '/tasks', 400, { title: 'x', userId: null }, tokenA);
  await request('Валидация requiredRole', 'POST', '/tasks', 400, { title: 'x', requiredRole: 'unknown' }, tokenA);
  const taskA = await request('Создание своей задачи', 'POST', '/tasks', 201, { title: `test_${suffix}`, description: 'Проверка сохранения' }, tokenA); tasks.push(taskA.id);
  check('Владелец берётся из JWT, requiredRole=user', taskA.userId === userA.id && taskA.requiredRole === 'user');
  await request('Своя задача доступна', 'GET', `/tasks/${taskA.id}`, 200, undefined, tokenA);
  await request('Чужая задача недоступна', 'GET', `/tasks/${taskA.id}`, 403, undefined, tokenB);
  await request('Нельзя менять чужую задачу', 'PATCH', `/tasks/${taskA.id}`, 403, { title: 'changed' }, tokenB);
  await request('Нельзя сменить владельца обычному пользователю', 'PATCH', `/tasks/${taskA.id}`, 403, { userId: userB.id }, tokenA);
  await request('Нельзя повысить роль задачи', 'PATCH', `/tasks/${taskA.id}`, 403, { requiredRole: 'administrator' }, tokenA);
  await request('Нельзя удалить задачу без роли administrator', 'DELETE', `/tasks/${taskA.id}`, 403, undefined, tokenA);
  await request('Пользователь с задачами защищён внешним ключом', 'DELETE', `/users/${userA.id}`, 409, undefined, adminToken);
  const updated = await request('Редактирование своей задачи', 'PATCH', `/tasks/${taskA.id}`, 200, { completed: true, description: null }, tokenA);
  check('Изменения задачи сохранены', updated.completed === true && updated.description === null);
  const privateTask = await request('Администратор создаёт задачу requiredRole=administrator', 'POST', '/tasks', 201,
    { title: `restricted_${suffix}`, userId: userA.id, requiredRole: 'administrator' }, adminToken); tasks.push(privateTask.id);
  await request('Владельцу без нужной роли закрыта административная задача', 'GET', `/tasks/${privateTask.id}`, 403, undefined, tokenA);
  await request('Администратор читает административную задачу', 'GET', `/tasks/${privateTask.id}`, 200, undefined, adminToken);
  const listA = await request('Список задач пользователя', 'GET', '/tasks', 200, undefined, tokenA);
  check('Список содержит только разрешённые свои задачи', listA.some((task) => task.id === taskA.id) && listA.every((task) => task.userId === userA.id && task.requiredRole === 'user'));
  const listB = await request('Список задач другого пользователя', 'GET', '/tasks', 200, undefined, tokenB);
  check('Чужие задачи не попадают в список B', listB.every((task) => task.userId === userB.id));
  await request('Фильтр по своему userId', 'GET', `/tasks/user/${userA.id}`, 200, undefined, tokenA);
  await request('Фильтр по чужому userId запрещён', 'GET', `/tasks/user/${userA.id}`, 403, undefined, tokenB);
  await request('Несуществующая задача', 'GET', '/tasks/2147483647', 404, undefined, adminToken);
  await request('Нечисловой id', 'GET', '/tasks/not-a-number', 400, undefined, tokenA);
  await request('Администратор меняет имя и email', 'PATCH', `/users/${userB.id}`, 200, { email: `updated_${b.email}` }, adminToken);
  await request('Конфликт email при изменении', 'PATCH', `/users/${userB.id}`, 409, { email: a.email }, adminToken);
  await request('Роли нельзя менять через обычное редактирование', 'PATCH', `/users/${userA.id}`, 400, { roles: ['administrator'] }, adminToken);

  saveLogs();
  const oldApi = docker(['compose', 'ps', '-q', 'api']).trim();
  const oldDb = docker(['compose', 'ps', '-q', 'db']).trim();
  docker(['compose', 'down']);
  docker(['compose', 'up', '-d', '--no-build', '--wait', '--wait-timeout', '180']);
  check('Оба контейнера действительно пересозданы', oldApi !== docker(['compose','ps','-q','api']).trim() && oldDb !== docker(['compose','ps','-q','db']).trim());
  await ready(base);
  await request('Вход после перезапуска API и PostgreSQL', 'POST', '/auth/login', 200, a);
  const persisted = await request('Задача и прежний JWT после перезапуска', 'GET', `/tasks/${taskA.id}`, 200, undefined, tokenA);
  check('Данные задачи пережили перезапуск API и БД', persisted.completed === true && persisted.title === taskA.title);
  await request('Роль user пережила перезапуск', 'GET', '/users', 403, undefined, tokenA);
  const transferred = await request('Администратор меняет владельца задачи', 'PATCH', `/tasks/${taskA.id}`, 200, { userId: userB.id }, adminToken);
  check('Новый владелец сохранён', transferred.userId === userB.id && transferred.user.id === userB.id);
  await request('Прежний владелец потерял доступ', 'GET', `/tasks/${taskA.id}`, 403, undefined, tokenA);
  await request('Новый владелец получил доступ', 'GET', `/tasks/${taskA.id}`, 200, undefined, tokenB);

  for (const id of [...tasks]) {
    await request('Удаление тестовой задачи администратором', 'DELETE', `/tasks/${id}`, 204, undefined, adminToken);
    tasks.splice(tasks.indexOf(id), 1);
    await request('Удалённая задача не найдена', 'GET', `/tasks/${id}`, 404, undefined, adminToken);
  }
  for (const id of [...users]) {
    await request('Удаление тестового пользователя', 'DELETE', `/users/${id}`, 204, undefined, adminToken);
    users.splice(users.indexOf(id), 1);
  }
  await request('JWT удалённого пользователя отклонён', 'GET', '/auth/profile', 401, undefined, tokenA);
  saveLogs();
  check('В логе сервера нет ошибок необработанных запросов', !serverLog.includes('ExceptionsHandler'));
}


main().catch(error => {
  console.error(error.stack);
  if (error.stderr) console.error(String(error.stderr));
  process.exitCode = 1;
}).finally(async () => {
  if (portContainer) {
    try { docker(['stop',portContainer]); docker(['rm',portContainer]); } catch {}
  }
  base = normalBase;
  if (adminToken) {
    for (const id of tasks) await request('Уборка тестовой задачи','DELETE',`/tasks/${id}`,204,undefined,adminToken).catch(()=>{});
    for (const id of users) await request('Уборка тестового пользователя','DELETE',`/users/${id}`,204,undefined,adminToken).catch(()=>{});
  }
  fs.writeFileSync(path.join(output,'server-test.log'),serverLog);
  const report = {passed:process.exitCode !== 1,checks:checks.length,results:checks};
  fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(report,null,2));
  console.log(`\n${report.passed?'PASS':'FAIL'}: ${checks.length} проверок. Отчёт: verification/results.json`);
});
