import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import type { AuthUser } from './auth-user.interface';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService, private readonly jwtService: JwtService) {}

  async register(dto: RegisterDto) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72) {
      throw new BadRequestException('Пароль не должен превышать 72 байта UTF-8');
    }
    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.usersService.createUser(dto, passwordHash);
  }

  async validateUser(username: string, password: string): Promise<AuthUser | null> {
    if (typeof username !== 'string' || typeof password !== 'string' ||
        username.length > 100 || Buffer.byteLength(password, 'utf8') > 72) return null;
    const user = await this.usersService.findForLogin(username.trim());
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) return null;
    return this.usersService.toPublicUser(user);
  }

  async login(user: AuthUser) {
    const access_token = await this.jwtService.signAsync({ sub: user.id, username: user.username });
    return { access_token, token_type: 'Bearer', expires_in: 3600, user };
  }
}
