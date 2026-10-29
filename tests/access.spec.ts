import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Repository } from 'typeorm';
import { RolesGuard } from '../src/roles/roles.guard';
import { Roles } from '../src/roles/roles.decorator';
import { RoleName } from '../src/roles/role-name.enum';
import { TasksService } from '../src/tasks/tasks.service';
import { Task } from '../src/tasks/entities/task.entity';
import { UsersService } from '../src/users/users.service';

@Roles(RoleName.Administrator)
class ExampleController {
  adminOnly() {}
  @Roles(RoleName.User)
  userAction() {}
}

describe('Проверка ролей', () => {
  const guard = new RolesGuard(new Reflector());
  function context(handler: () => void, roles?: RoleName[]) {
    return { getClass: () => ExampleController, getHandler: () => handler,
      switchToHttp: () => ({ getRequest: () => ({ user: roles ? { roles } : undefined }) }) } as unknown as ExecutionContext;
  }
  test('Обычный пользователь не получает права администратора', () => {
    expect(guard.canActivate(context(ExampleController.prototype.adminOnly, [RoleName.User]))).toBe(false);
  });
  test('Администратор получает доступ', () => {
    expect(guard.canActivate(context(ExampleController.prototype.adminOnly, [RoleName.Administrator]))).toBe(true);
  });
  test('Без пользователя защищённый метод недоступен', () => {
    expect(guard.canActivate(context(ExampleController.prototype.adminOnly))).toBe(false);
  });
  test('Роли метода переопределяют роли контроллера', () => {
    expect(guard.canActivate(context(ExampleController.prototype.userAction, [RoleName.User]))).toBe(true);
  });
});

describe('Доступ к задачам', () => {
  const repository = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
  const users = { getUserById: jest.fn() };
  const service = new TasksService(repository as unknown as Repository<Task>, users as unknown as UsersService);
  const owner = { id: 1, username: 'owner', email: 'o@example.com', roles: [RoleName.User] };
  const other = { ...owner, id: 2 };
  const admin = { ...other, roles: [RoleName.Administrator] };
  beforeEach(() => {
    repository.findOne.mockResolvedValue({ id: 5, title: 'Homework', userId: 1, requiredRole: RoleName.User });
  });
  test('Владелец читает свою задачу', async () => {
    expect((await service.getTaskById(5, owner)).title).toBe('Homework');
  });
  test('Другой пользователь не читает чужую задачу', async () => {
    await expect(service.getTaskById(5, other)).rejects.toBeInstanceOf(ForbiddenException);
  });
  test('Администратор читает задачу другого владельца', async () => {
    expect((await service.getTaskById(5, admin)).userId).toBe(1);
  });
  test('Владелец без административной роли не читает административную задачу', async () => {
    repository.findOne.mockResolvedValue({ id: 5, userId: 1, requiredRole: RoleName.Administrator });
    await expect(service.getTaskById(5, owner)).rejects.toBeInstanceOf(ForbiddenException);
  });
  test('Отсутствующая задача возвращает 404', async () => {
    repository.findOne.mockResolvedValue(null);
    await expect(service.getTaskById(5, owner)).rejects.toBeInstanceOf(NotFoundException);
  });
  test('Пользователь не меняет владельца своей задачи', async () => {
    await expect(service.updateTask(5, { userId: 2 }, owner)).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
