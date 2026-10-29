const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const action = process.argv[2] || 'start';
if (!['start', 'stop', 'status'].includes(action)) throw new Error('Use start, stop or status.');
const bundled = path.join(os.homedir(), 'Documents', 'Codex', 'tools', 'github-cli', 'runtime', 'bin', 'gh.exe');
const executable = process.env.GH_BIN || (process.platform === 'win32' && fs.existsSync(bundled) ? bundled : 'gh');
const repository = 'Greaf07/veb-lab19-cicd';

function run(args, capture = false) {
  const result = spawnSync(executable, args, { encoding: 'utf8', stdio: capture ? 'pipe' : 'inherit', windowsHide: true });
  if (result.error) throw new Error('Установите GitHub CLI и выполните gh auth login. ' + result.error.message);
  if (result.status !== 0) throw new Error('GitHub CLI завершился с ошибкой.');
  return result.stdout;
}

async function main() {
  const requestedAt = Date.now() - 5000;
  run(['workflow', 'run', 'cloud.yml', '-R', repository, '--ref', 'main', '-f', `action=${action}`]);
  let workflow;
  for (let attempt = 0; attempt < 20; attempt++) {
    const runs = JSON.parse(run(['run', 'list', '-R', repository, '--workflow', 'cloud.yml', '--limit', '5', '--json', 'databaseId,createdAt,url,event'], true));
    workflow = runs.find(item => item.event === 'workflow_dispatch' && Date.parse(item.createdAt) >= requestedAt);
    if (workflow) break;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  if (!workflow) throw new Error('Запрос отправлен. Проверьте новый запуск cloud.yml в GitHub Actions.');
  console.log(workflow.url);
  run(['run', 'watch', String(workflow.databaseId), '-R', repository, '--exit-status', '--interval', '5']);
  console.log(action === 'start' ? 'Облако включено и /health проверен. Ссылка есть в Summary запуска.' : 'Команда выполнена.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
