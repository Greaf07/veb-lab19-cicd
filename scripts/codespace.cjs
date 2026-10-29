const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const mode = process.argv[2] || 'start';
const name = process.env.CODESPACE_NAME;
if (!name || !/^[a-z0-9-]+$/.test(name)) throw new Error('Set CODESPACE_NAME.');
if (!['deploy', 'start', 'stop', 'status'].includes(mode)) throw new Error('Unknown operation.');
if (!process.env.GH_TOKEN) throw new Error('Configure CODESPACES_TOKEN in GitHub Actions Secrets.');

function gh(args, input, capture = false) {
  const result = spawnSync(process.env.GH_BIN || 'gh', args, {
    input, encoding: 'utf8', timeout: 600000, windowsHide: true,
    stdio: [input === undefined ? 'ignore' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`GitHub CLI failed (${result.status}).`);
  return result.stdout?.trim();
}

async function main() {
  if (mode === 'stop') {
    gh(['codespace', 'stop', '-c', name]);
    console.log('Codespace stopped. Application files and PostgreSQL data are preserved.');
    return;
  }
  if (mode === 'status') {
    const result = gh(['codespace', 'list', '-R', 'Greaf07/veb-lab19-cicd', '--json', 'name,state,machineName'], undefined, true);
    console.log(result);
    return;
  }
  const version = mode === 'deploy' ? process.env.EXPECTED_VERSION : '';
  if (mode === 'deploy' && !/^[0-9a-f]{40}$/.test(version || '')) throw new Error('Set EXPECTED_VERSION to the commit SHA.');
  const script = fs.readFileSync(path.join(__dirname, 'remote-codespace.sh'), 'utf8');
  // gh starts a stopped Codespace before connecting through its authenticated SSH relay.
  gh(['codespace', 'ssh', '-c', name, '--', `bash -s -- ${mode} ${version}`], script);
  gh(['codespace', 'ports', 'visibility', '3006:public', '-c', name]);
  const ports = JSON.parse(gh(['codespace', 'ports', '-c', name, '--json', 'sourcePort,browseUrl,visibility'], undefined, true));
  const port = ports.find(item => item.sourcePort === 3006);
  if (!port || port.visibility !== 'public' || !port.browseUrl?.startsWith('https://')) {
    throw new Error('The public HTTPS port was not created.');
  }
  const url = port.browseUrl.replace(/\/$/, '');
  let lastError;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(url + '/health', { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Health HTTP ${response.status}`);
      const health = await response.json();
      if (health.status !== 'ok' || health.database !== 'connected') throw new Error('Database is not ready.');
      if (version && health.version !== version) throw new Error('The deployed version does not match the commit.');
      console.log(JSON.stringify({ url, ...health }, null, 2));
      if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `public_url=${url}\n`);
      }
      if (process.env.GITHUB_STEP_SUMMARY) {
        fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
          `Application: ${url}\n\nHealth: ${url}/health\n\nVersion: \`${health.version}\`\n\nPostgreSQL: connected\n`);
      }
      return;
    } catch (error) {
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }
  throw lastError;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
