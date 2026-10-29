import { BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../src/auth/auth.service';
import { UsersService } from '../src/users/users.service';
import { RoleName } from '../src/roles/role-name.enum';

describe('Авторизация', () => {
  const publicUser = { id: 1, username: 'student', email: 'student@example.com', roles: [RoleName.User] };
  const users = { findForLogin: jest.fn(), toPublicUser: jest.fn(), createUser: jest.fn() };
  const jwt = new JwtService({ secret: 'unit-test-secret-only-12345678901234567890',
    signOptions: { expiresIn: 3600, issuer: 'lab19', audience: 'lab19-api' } });
  const auth = new AuthService(users as unknown as UsersService, jwt);
  let hash: string;

  beforeAll(async () => { hash = await bcrypt.hash('Password123!', 10); });
  beforeEach(() => {
    users.findForLogin.mockResolvedValue({ ...publicUser, passwordHash: hash });
    users.toPublicUser.mockReturnValue(publicUser);
    users.createUser.mockResolvedValue(publicUser);
  });

  test('Верный пароль принимается; пароль и хеш не возвращаются', async () => {
    const result = await auth.validateUser(' student ', 'Password123!');
    expect(result).toEqual(publicUser);
    expect(users.findForLogin).toHaveBeenCalledWith('student');
    expect(result).not.toHaveProperty('passwordHash');
  });
  test('Неверный пароль отклоняется', async () => {
    expect(await auth.validateUser('student', 'Wrong123!')).toBeNull();
  });
  test('Несуществующий пользователь отклоняется', async () => {
    users.findForLogin.mockResolvedValue(null);
    expect(await auth.validateUser('missing', 'Password123!')).toBeNull();
  });
  test('Слишком длинный пароль отклоняется до обращения к БД', async () => {
    expect(await auth.validateUser('student', 'я'.repeat(37))).toBeNull();
    expect(users.findForLogin).not.toHaveBeenCalled();
  });
  test('Регистрация передаёт в БД bcrypt-хеш вместо пароля', async () => {
    const dto = { username: 'student', email: 'student@example.com', password: 'Password123!' };
    expect(await auth.register(dto)).toEqual(publicUser);
    const storedHash = users.createUser.mock.calls[0][1];
    expect(storedHash).not.toBe(dto.password);
    expect(await bcrypt.compare(dto.password, storedHash)).toBe(true);
    expect(bcrypt.getRounds(storedHash)).toBe(10);
  });
  test('Регистрация учитывает лимит bcrypt в байтах UTF-8', async () => {
    await expect(auth.register({ username: 'student', email: 'a@example.com', password: 'я'.repeat(37) }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(users.createUser).not.toHaveBeenCalled();
  });
  test('Выданный JWT проверяется подписью и имеет срок 1 час', async () => {
    const result = await auth.login(publicUser);
    const payload = await jwt.verifyAsync(result.access_token, { issuer: 'lab19', audience: 'lab19-api' });
    expect(payload.sub).toBe(publicUser.id);
    expect(payload.exp - payload.iat).toBe(3600);
    expect(payload).not.toHaveProperty('roles');
    expect(payload).not.toHaveProperty('passwordHash');
    expect(result.token_type).toBe('Bearer');
  });
});
