Лабораторная работа №19 по методичке (папка lab9)
Развёртывание NestJS в облаке и настройка CI/CD

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
   и развёртывание в облаке. Health должен показать SHA нового коммита.
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

Адрес репозитория, результаты удалённого запуска и адрес приложения
фиксируются в Проверка.txt после фактического выполнения.
