import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @ValidateIf((object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username?: string;

  @ValidateIf((object, value) => value !== undefined)
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsEmail()
  @MaxLength(254)
  email?: string;
}
