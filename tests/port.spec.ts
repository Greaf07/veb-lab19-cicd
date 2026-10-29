import { getPort } from '../src/config/port';

describe('Порт облачного приложения', () => {
  test.each([undefined, ''])('По умолчанию PORT=%s -> 3000', value => {
    expect(getPort(value)).toBe(3000);
  });
  test.each(['10000', '31919', '65535'])('Принимает назначенный порт %s', value => {
    expect(getPort(value)).toBe(Number(value));
  });
  test.each(['0', '-1', '65536', 'abc', '3000.5'])('Отклоняет неправильный PORT=%s', value => {
    expect(() => getPort(value)).toThrow();
  });
});
