Лабораторная работа №19 по методичке (папка lab9)
Развёртывание NestJS в облаке и настройка CI/CD

Основа — приложение ЛР №18: NestJS, PostgreSQL, JWT и роли.
Репозиторий: https://github.com/Greaf07/veb-lab19-cicd
Образ: ghcr.io/greaf07/veb-lab19-cicd
Проверенные результаты и ссылки — Проверка.txt.
Порядок защиты по каждой строке задания — Защита.txt.

БЫСТРОЕ ВКЛЮЧЕНИЕ ОБЛАКА ПЕРЕД ЗАЩИТОЙ
Из папки lab9: npm.cmd run cloud:start
Команда запускает cloud.yml в GitHub Actions и ждёт успешного /health.
HTTPS-адрес находится в Summary запуска. Пересборка для включения не нужна.
На этом компьютере Node.js и авторизованный GitHub CLI уже подготовлены.
Через сайт: Actions -> Start or stop lab19 for defense -> Run workflow -> start.
После показа: npm.cmd run cloud:stop
Для проверки API в облаке: npm.cmd run cloud:demo
Состояние среды: npm.cmd run cloud:status
Полная проверка сохранения записи при остановке и включении среды:
  npm.cmd run cloud:verify-restart
Эта проверка действительно останавливает среду на короткое время; запускать
до демонстрации. Она удаляет только свою временную тестовую задачу.
Подробности и инструкция для следующего включения — ЗАПУСК_ПЕРЕД_ЗАЩИТОЙ.txt.

Codespaces здесь используется как учебная облачная среда с Docker и PostgreSQL.
Это не постоянный production-хостинг: при простое среда останавливается.
Перед защитой запустить за 5–10 минут. Данные БД хранятся в /workspaces/lab19-cloud/postgres.
Остановка Codespace их сохраняет. Удаление всей среды удаляет и её данные.

ЛОКАЛЬНЫЙ ЗАПУСК НА WINDOWS
Нужны Node.js 24.x, npm и запущенный Docker Desktop с Linux-контейнерами.
Официальные установщики: https://nodejs.org/ и https://www.docker.com/products/docker-desktop/
После установки откройте новый терминал и проверьте:
  node --version
  npm.cmd --version
  docker version
В docker version должны быть Client и Server. Если Server недоступен,
запустите Docker Desktop и дождитесь готовности Engine.

Откройте папку lab9 в VS Code. В её терминале при первом запуске:
  npm.cmd ci --no-audit --no-fund
  npm.cmd start
При повторном запуске достаточно npm.cmd start.
Скрипт создаёт .env со случайными паролями, собирает Docker-образ,
запускает PostgreSQL и API, добавляет учебные аккаунты admin и student.
Существующий .env и данные базы не перезаписываются.

Проверка в браузере:
  http://localhost:3006
  http://localhost:3006/health
Без JWT маршрут /tasks отвечает 401 — это ожидаемая защита.
Пароли учебных аккаунтов хранятся только в локальном .env.

КОМАНДЫ
  npm.cmd run test        — 29 модульных тестов Jest, без Docker и БД
  npm.cmd run build       — компиляция TypeScript в dist
  npm.cmd run ci:local    — тесты, сборка, Docker и проверки API/БД
  npm.cmd run test:e2e    — 121 проверка уже собранного Docker-образа
  npm.cmd run demo        — демонстрация регистрации, JWT и ролей
  npm.cmd run demo:steps  — краткая карта файлов по заданиям
  npm.cmd run status     — состояние контейнеров
  npm.cmd run logs       — последние строки журнала
  npm.cmd stop           — остановка без удаления данных

Для проверки test:e2e предварительно выполните npm.cmd start или
npm.cmd run build:docker. Эти проверки временно пересоздают контейнеры
ТОЛЬКО проекта veb-lab19 и удаляют только созданные ими тестовые записи.
Том PostgreSQL сохраняется. Другие лабораторные не затрагиваются.
Не удаляйте том veb-lab19_pgdata и не запускайте docker compose down -v,
если хотите сохранить пользователей и задачи.

ЕСЛИ НЕ ЗАПУСКАЕТСЯ
1. npm.ps1 запрещён политикой PowerShell — используйте именно npm.cmd.
2. Docker Engine недоступен — запустите Docker Desktop, проверьте docker version.
3. Порт 3006 занят — поменяйте APP_PORT в .env и выполните npm.cmd start.
4. Неверный пароль PostgreSQL после изменения .env — верните прежний пароль:
   переменная окружения не меняет пароль уже созданной базы.
5. Health отвечает 503 — откройте npm.cmd run logs, проверьте подключение к БД.

ЧТО СДЕЛАНО ПО ЗАДАНИЯМ
1. main.ts получает порт через getPort(process.env.PORT), по умолчанию 3000.
   HOST=0.0.0.0. Procfile содержит web: node dist/main.js.
   npm run build запускает nest build.
2. deploy.yml: push в main -> checkout -> setup-node -> npm ci -> Jest ->
   сборка NestJS -> оптимизированный Docker-образ -> E2E с PostgreSQL ->
   публикация образа в GHCR -> загрузка того же образа в Codespaces -> /health.
   npm ci — установка точных версий из package-lock.json для CI.
   Тег образа равен SHA коммита. В облаке образ не пересобирается.
   Скрипт codespace.cjs подключается через авторизованный SSH GitHub CLI,
   remote-codespace.sh загружает Compose именно этого коммита и запускает образ.
3. npm run test выполняется после установки зависимостей, до сборки.
   Ошибка Jest останавливает следующие обычные шаги. always() применяется
   только к очистке тестовых контейнеров на runner GitHub Actions.

ОБЛАЧНАЯ КОНФИГУРАЦИЯ
Secret CODESPACES_TOKEN — отдельный fine-grained токен только репозитория lab9,
срок до 28 ноября 2026. Codespaces и Codespaces lifecycle admin: read/write;
Codespaces metadata, Contents и обязательные Metadata: read-only.
Variable CODESPACE_NAME = weary-coffin-69gvrwq9jvr5h5qv4.
GITHUB_TOKEN создаётся автоматически; packages: write разрешает отправку в GHCR.
Пароли БД, учебных аккаунтов и JWT_SECRET генерируются один раз внутри облака
и хранятся в /workspaces/lab19-cloud/.env. В Git и журналы они не выводятся.
В Codespaces API использует сетевой интерфейс контейнера БД
(network_mode: service:db, DB_HOST=127.0.0.1); это обход блокировки Docker bridge.
Публичен только HTTPS-порт приложения 3006. Порт PostgreSQL наружу не открыт.
Секрет Windows .env отличается от облачного. Не заменять один другим.

На новом аккаунте эта настройка сама не появляется: потребуется создать свой
Codespace, изменить имя/репозиторий в скриптах и настроить свой scoped-токен.
Для показа с другого ПК достаточно войти на сайт GitHub владельцем и запустить workflow.
Терминальный вариант: Node.js + GitHub CLI, затем gh auth login и cloud:start.

ОГРАНИЧЕНИЯ И ВОССТАНОВЛЕНИЕ
Не включать платный тариф автоматически. GitHub Free имеет лимиты времени
и хранения; остановленная среда продолжает занимать хранилище.
При истечении токена обновить CODESPACES_TOKEN с теми же правами и новым сроком.
При удалённом Codespace сначала восстановить/создать среду и настроить её имя,
затем выполнить полный deploy.yml. cloud:start предназначен для уже развёрнутой среды.
Если cloud:start не прошёл, открыть журнал Actions; он не сообщает успех без /health.
Локальный резерв работает независимо от Codespaces: npm.cmd start.

СТРУКТУРА
src/ — NestJS; tests/ — Jest; scripts/ — запуск, проверки и демонстрация.
.github/workflows/deploy.yml — автоматический полный CI/CD.
.github/workflows/cloud.yml — быстрое управление облаком без пересборки.
Dockerfile — двухэтапная production-сборка, процесс от пользователя node.
Procfile — команда для платформ, поддерживающих этот формат; Docker использует CMD.
answers.txt — 5 ответов; Защита.txt — показ по заданию; Проверка.txt — доказательства.
verification/ — локальные отчёты, не включаются в Git.

ОФИЦИАЛЬНЫЕ ИСТОЧНИКИ
https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs
https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
https://docs.nestjs.com/fundamentals/testing
https://cli.github.com/manual/gh_codespace_ssh
https://cli.github.com/manual/gh_codespace_ports
https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage
https://docs.github.com/en/codespaces/setting-your-user-preferences/configuring-automatic-deletion-of-your-codespaces
