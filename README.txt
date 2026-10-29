Лабораторная работа №19 по методичке (папка lab9)
Развёртывание NestJS в облаке и настройка CI/CD

СТАТУС: локальная часть, тесты в GitHub Actions и публикация образа выполнены.
Облачный запуск пока не завершён: требуется подтверждение аккаунта Vercel.
Подробные доказательства и ограничения — Проверка.txt.

Основа — приложение лабораторной №18: NestJS, PostgreSQL, JWT и роли.
Исходники прежних лабораторных не изменяются.

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
   HOST по умолчанию 0.0.0.0. Procfile запускает node dist/main.js.
   npm run build выполняет nest build.
2. .github/workflows/deploy.yml запускается при push в main.
   После checkout и setup-node устанавливаются зависимости через npm ci.
   Это воспроизводимый вариант установки по package-lock.json для CI.
   Затем идут тесты, сборка NestJS, оптимизированный Docker-образ,
   настоящие проверки API/БД, отправка образа в GitHub Container Registry
   и подготовленный деплой в Vercel. Health должен показать SHA нового коммита.
   В Vercel NestJS работает как Function, Docker-образ отдельно хранится в GHCR.
   Это два способа запуска исходников одного коммита.
3. Jest выполняется до сборки. При ненулевом коде выхода следующие шаги
   не выполняются. continue-on-error не используется. always() есть только
   у очистки тестовых контейнеров.

СТРУКТУРА
  src/             — исходный NestJS-код
  tests/           — тесты порта, пароля/JWT, ролей, задач и health
  scripts/         — локальный запуск, проверка и демонстрация
  .github/workflows/deploy.yml — конвейер GitHub Actions
  Dockerfile       — двухэтапная production-сборка из предыдущей работы
  Procfile         — команда запуска для совместимых PaaS
  answers.txt      — ответы на 5 контрольных вопросов
  Защита.txt       — порядок показа преподавателю
  Проверка.txt     — фактически выполненные проверки и облачный статус
  verification/    — локальные результаты запусков, не включаются в Git

Секреты не публикуются: .env исключён из Git и Docker-контекста.
В облаке используются отдельные настройки PostgreSQL и JWT_SECRET.
В production-образе отсутствуют исходники, тесты, Nest CLI и TypeScript;
процесс работает от пользователя node.

ОФИЦИАЛЬНЫЕ ИСТОЧНИКИ
https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs
https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images
https://docs.nestjs.com/fundamentals/testing
https://vercel.com/docs/frameworks/backend/nestjs
https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
https://neon.com/pricing

Адрес репозитория, результаты удалённого запуска и адрес приложения
фиксируются в Проверка.txt после фактического выполнения.


КАК ЗАВЕРШИТЬ ОБЛАЧНУЮ НАСТРОЙКУ
1. Завершить вход в Vercel и выбрать Hobby, без Pro trial и карты.
   В Neon выбрать Free, создать отдельный проект veb-lab19 с PostgreSQL.
2. Создать проект Vercel для этого NestJS-приложения. Рекомендуемый регион
   базы — Frankfurt: он совпадает с fra1 в vercel.json.
   В Production Environment Variables Vercel сохранить:
     DATABASE_URL — строка подключения из Neon;
     DB_SSL — true;
     JWT_SECRET — отдельная случайная строка длиной не менее 32 символов.
   Строку подключения и секрет не вставлять в Git, скриншоты или отчёт.
3. В GitHub -> Settings -> Secrets and variables -> Actions добавить:
     Secret VERCEL_TOKEN — токен Vercel с минимально доступными правами;
     Variables VERCEL_ORG_ID, VERCEL_PROJECT_ID — ID из настроек Vercel;
     Variable PUBLIC_URL — постоянный HTTPS-адрес приложения.
4. Запустить workflow кнопкой Run workflow или push в main.
   vercel.json отключает отдельный деплой Git-интеграции, чтобы публикацию
   выполнял именно Actions после тестов. Не включать второй автодеплой.
5. Дождаться успеха всех шагов, открыть PUBLIC_URL/health и сравнить version
   с SHA запуска. Пока этого нет, облачная часть считается незавершённой.

Vercel CLI устанавливается в Actions автоматически (версия 65.7.0).
CLI выполняет pull -> build --prod -> deploy --prebuilt --prod.
Предварительная сборка формирует формат Vercel Function. Приложение при этом
сохраняет локальный запуск в Docker и PostgreSQL, как в предыдущей работе.
.vercel, локальные .env и результаты проверок исключены из публикации.

Бесплатные сервисы имеют лимиты и могут приостанавливать неактивную базу.
Перед защитой открыть /health и дождаться ответа. При исчерпании лимита
не переходить на платный тариф автоматически.
