async function verify() {
  const { PUBLIC_URL, EXPECTED_VERSION } = process.env;
  if (!PUBLIC_URL || !EXPECTED_VERSION) throw new Error('Нужны PUBLIC_URL и EXPECTED_VERSION.');
  const url = new URL('/health', PUBLIC_URL);
  if (url.protocol !== 'https:') throw new Error('Для облачного приложения нужен HTTPS.');
  console.log('Ожидаю готовность опубликованной версии: ' + EXPECTED_VERSION);
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (response.ok) {
        const health = await response.json();
        if (health.status === 'ok' && health.database === 'connected' && health.version === EXPECTED_VERSION) {
          console.log('Деплой подтверждён: ' + url);
          return;
        }
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 10000));
  }
  throw new Error('Новая версия не стала доступна. Проверьте журнал Codespaces в GitHub Actions.');
}

verify().catch(error => { console.error(error.message); process.exitCode = 1; });
