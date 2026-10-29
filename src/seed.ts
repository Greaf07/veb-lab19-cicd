import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AuthService } from './auth/auth.service';
import { UsersService } from './users/users.service';
import { RoleName } from './roles/role-name.enum';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const auth = app.get(AuthService);
    const users = app.get(UsersService);
    const accounts = [
      { username: 'admin', email: 'admin@example.com', password: process.env.DEMO_ADMIN_PASSWORD, roles: [RoleName.User, RoleName.Administrator] },
      { username: 'student', email: 'student@example.com', password: process.env.DEMO_USER_PASSWORD, roles: [RoleName.User] },
    ];
    for (const account of accounts) {
      if (await users.findByUsername(account.username)) continue;
      if (!account.password || account.password.length < 8) throw new Error('Задайте учебные пароли в .env');
      const user = await auth.register({ username: account.username, email: account.email, password: account.password });
      await users.updateRoles(user.id, account.roles);
      console.log('Создан учебный пользователь: ' + account.username);
    }
    console.log('Учебные роли и пользователи готовы.');
  } finally {
    await app.close();
  }
}

seed().catch((error) => { console.error(error.message); process.exitCode = 1; });
