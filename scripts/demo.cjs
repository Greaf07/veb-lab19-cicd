const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
process.chdir(require('node:path').resolve(__dirname, '..'));
console.log('ЛР 19: подготовка к облаку и CI/CD');
console.log('1. src/main.ts: PORT из окружения, HOST=0.0.0.0');
console.log('   Procfile: ' + fs.readFileSync('Procfile', 'utf8').trim());
console.log('2. .github/workflows/deploy.yml: push main -> тесты -> сборка -> GHCR -> Northflank');
console.log('3. npm run test: ошибка теста останавливает следующие шаги.');
console.log('   npm run ci:local: полная локальная проверка, без публикации.');
console.log('Публичные ссылки и порядок защиты: Защита.txt');
if (!process.argv.includes('--steps')) {
  const result = spawnSync(process.execPath, ['scripts/demo-api.cjs'], { stdio: 'inherit', windowsHide: true });
  process.exitCode = result.status ?? 1;
}
