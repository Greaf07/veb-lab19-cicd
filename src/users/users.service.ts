import { ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, QueryFailedError, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { RoleName } from '../roles/role-name.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import type { AuthUser } from '../auth/auth-user.interface';

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    @InjectRepository(User) private readonly usersRepository: Repository<User>,
    @InjectRepository(Role) private readonly rolesRepository: Repository<Role>,
  ) {}

  async onModuleInit() {
    await this.rolesRepository.upsert([
      { name: RoleName.User }, { name: RoleName.Administrator },
    ], ['name']);
  }

  toPublicUser(user: User): AuthUser {
    return { id: user.id, username: user.username, email: user.email, roles: user.roles.map((role) => role.name) };
  }

  async getAllUsers() {
    const users = await this.usersRepository.find({ order: { id: 'ASC' } });
    return users.map((user) => this.toPublicUser(user));
  }

  findById(id: number) {
    return this.usersRepository.findOneBy({ id });
  }

  async getUserById(id: number) {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  findByUsername(username: string) {
    return this.usersRepository.findOneBy({ username });
  }

  findForLogin(username: string) {
    return this.usersRepository.createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .leftJoinAndSelect('user.roles', 'role')
      .where('user.username = :username', { username })
      .getOne();
  }

  async createUser(dto: CreateUserDto, passwordHash: string) {
    const roles = await this.rolesRepository.findBy({ name: RoleName.User });
    const user = this.usersRepository.create({ username: dto.username, email: dto.email, passwordHash, roles });
    try {
      await this.usersRepository.save(user);
      return this.toPublicUser(user);
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateUser(id: number, dto: UpdateUserDto) {
    const user = await this.getUserById(id);
    Object.assign(user, dto);
    try {
      await this.usersRepository.save(user);
      return this.toPublicUser(user);
    } catch (error) {
      this.handleError(error);
    }
  }

  async updateRoles(id: number, names: RoleName[]) {
    const user = await this.getUserById(id);
    user.roles = await this.rolesRepository.findBy({ name: In(names) });
    await this.usersRepository.save(user);
    return this.toPublicUser(user);
  }

  async deleteUser(id: number) {
    const user = await this.getUserById(id);
    try {
      await this.usersRepository.remove(user);
    } catch (error) {
      this.handleError(error);
    }
  }

  private handleError(error: unknown): never {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (code === '23505') throw new ConflictException('Имя или email уже заняты');
      if (code === '23503') throw new ConflictException('Сначала удалите задачи пользователя');
    }
    throw error;
  }
}
