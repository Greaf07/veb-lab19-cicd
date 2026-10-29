import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';

describe('Проверка готовности облачной версии', () => {
  const db = { query: jest.fn() };
  const controller = new AppController(new AppService(), db as unknown as DataSource);
  const originalVersion = process.env.APP_VERSION;
  afterEach(() => {
    if (originalVersion === undefined) delete process.env.APP_VERSION;
    else process.env.APP_VERSION = originalVersion;
  });
  test('Health действительно обращается к БД и сообщает версию', async () => {
    db.query.mockResolvedValue([{ '?column?': 1 }]);
    process.env.APP_VERSION = 'test-commit';
    expect(await controller.health()).toEqual({ status: 'ok', database: 'connected', version: 'test-commit' });
    expect(db.query).toHaveBeenCalledWith('SELECT 1');
  });
  test('Сбой БД даёт 503, а не ложный успешный ответ', async () => {
    db.query.mockRejectedValue(new Error('connection failed'));
    await expect(controller.health()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
