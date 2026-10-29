async function deploy() {
  const { NORTHFLANK_API_TOKEN, NORTHFLANK_PROJECT, NORTHFLANK_SERVICE, IMAGE, EXPECTED_VERSION } = process.env;
  if (!NORTHFLANK_API_TOKEN || !NORTHFLANK_PROJECT || !NORTHFLANK_SERVICE || !IMAGE || !EXPECTED_VERSION) {
    throw new Error('Настройте NORTHFLANK_API_TOKEN, NORTHFLANK_PROJECT и NORTHFLANK_SERVICE в GitHub Actions.');
  }
  const endpoint = 'https://api.northflank.com/v1/projects/' + encodeURIComponent(NORTHFLANK_PROJECT)
    + '/services/' + encodeURIComponent(NORTHFLANK_SERVICE) + '/deployment';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + NORTHFLANK_API_TOKEN },
    body: JSON.stringify({ external: { imagePath: `${IMAGE}:${EXPECTED_VERSION}` }, docker: { configType: 'default' } }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error('Northflank отклонил деплой: HTTP ' + response.status);
  console.log('Northflank принял образ ' + IMAGE + ':' + EXPECTED_VERSION);
}

deploy().catch(error => { console.error(error.message); process.exitCode = 1; });
