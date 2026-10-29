const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const result = { completed: [], failed: null };
const commands = [ ['test'], ['build'], ['build:docker'], ['test:e2e'] ];
for (const args of commands) {
  console.log('\nЭтап: npm run ' + args[0]);
  const run = spawnSync(process.execPath, [process.env.npm_execpath, 'run', ...args], {cwd:root,stdio:'inherit',windowsHide:true});
  if (run.status !== 0) { result.failed = args[0]; process.exitCode = 1; break; }
  result.completed.push(args[0]);
}
fs.mkdirSync(path.join(root,'verification'), {recursive:true});
fs.writeFileSync(path.join(root,'verification/ci-local.json'),JSON.stringify(result,null,2));
console.log(result.failed ? 'Конвейер остановлен на этапе ' + result.failed : 'Локальные этапы CI успешно выполнены.');
console.log('Публикация и облачный деплой выполняются отдельно в GitHub Actions.');
