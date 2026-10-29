import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { jwtSettings } from '../jwt.config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSettings.secret,
      ignoreExpiration: false,
      algorithms: ['HS256'],
      issuer: jwtSettings.issuer,
      audience: jwtSettings.audience,
    });
  }

  async validate(payload: { sub: number }) {
    if (!Number.isInteger(payload.sub) || payload.sub < 1 || payload.sub > 2147483647) {
      throw new UnauthorizedException();
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return this.usersService.toPublicUser(user);
  }
}
