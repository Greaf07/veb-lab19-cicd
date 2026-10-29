const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
require('./config.cjs');

function docker(args) {
  const result = spawnSync('docker', args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.error) throw new Error('Docker не найден. Установите Docker Desktop и откройте новый терминал.');
  if (result.status !== 0) throw new Error('Команда Docker завершилась с ошибкой. Проверьте сообщение выше.');
}

try {
  const action = process.argv[2];
  if (action === 'up') docker(['compose', 'up', '-d', '--build', '--wait', '--wait-timeout', '180']);
  else if (action === 'stop') docker(['compose', 'stop']);
  else if (action === 'status') docker(['compose', 'ps']);
  else if (action === 'logs') docker(['compose', 'logs', '--tail', '80']);
  else if (action === 'build-optimized') docker(['build', '-f', 'Dockerfile', '-t', 'veb-lab19:optimized', '.']);
  else if (action === 'seed') docker(['compose', 'exec', '-T', 'api', 'node', 'dist/seed.js']);
  else throw new Error('Неизвестная команда: ' + action);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
