import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/\S/, { message: 'Пароль не должен состоять только из пробелов' })
  password: string;
}
