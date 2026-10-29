import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from './entities/task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UsersService } from '../users/users.service';
import { RoleName } from '../roles/role-name.enum';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task) private readonly tasksRepository: Repository<Task>,
    private readonly usersService: UsersService,
  ) {}

  private isAdmin(user: AuthUser) {
    return user.roles.includes(RoleName.Administrator);
  }

  getAllTasks(user: AuthUser) {
    const where = this.isAdmin(user) ? {} : { userId: user.id, requiredRole: RoleName.User };
    return this.tasksRepository.find({ where, relations: { user: true }, order: { id: 'ASC' } });
  }

  async getTaskById(id: number, user: AuthUser) {
    const task = await this.tasksRepository.findOne({ where: { id }, relations: { user: true } });
    if (!task) throw new NotFoundException('Задача не найдена');
    if (!this.isAdmin(user) && (task.userId !== user.id || task.requiredRole === RoleName.Administrator)) {
      throw new ForbiddenException('Нет доступа к этой задаче');
    }
    return task;
  }

  async getTasksByUser(userId: number, user: AuthUser) {
    if (!this.isAdmin(user) && userId !== user.id) throw new ForbiddenException();
    await this.usersService.getUserById(userId);
    const where = this.isAdmin(user) ? { userId } : { userId, requiredRole: RoleName.User };
    return this.tasksRepository.find({ where, relations: { user: true }, order: { id: 'ASC' } });
  }

  private checkAssignment(userId: number, requiredRole: RoleName, user: AuthUser) {
    if (!this.isAdmin(user) && (userId !== user.id || requiredRole === RoleName.Administrator)) {
      throw new ForbiddenException('Назначать чужого владельца или роль administrator может только администратор');
    }
  }

  async createTask(dto: CreateTaskDto, user: AuthUser) {
    const userId = dto.userId ?? user.id;
    const requiredRole = dto.requiredRole ?? RoleName.User;
    this.checkAssignment(userId, requiredRole, user);
    await this.usersService.getUserById(userId);
    const task = this.tasksRepository.create({ ...dto, userId, requiredRole });
    await this.tasksRepository.save(task);
    return this.getTaskById(task.id, user);
  }

  async updateTask(id: number, dto: UpdateTaskDto, user: AuthUser) {
    const task = await this.getTaskById(id, user);
    this.checkAssignment(dto.userId ?? task.userId, dto.requiredRole ?? task.requiredRole, user);
    if (dto.userId !== undefined) task.user = await this.usersService.getUserById(dto.userId);
    Object.assign(task, dto);
    await this.tasksRepository.save(task);
    return this.getTaskById(id, user);
  }

  async deleteTask(id: number, user: AuthUser) {
    const task = await this.getTaskById(id, user);
    await this.tasksRepository.remove(task);
  }
}
