import { RoleName } from '../../roles/role-name.enum';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, Max, IsNotEmpty, IsOptional, IsString, MaxLength, Min, ValidateIf } from 'class-validator';

export class CreateTaskDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ValidateIf((object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  userId?: number;
  @ValidateIf((object, value) => value !== undefined)
  @IsEnum(RoleName)
  requiredRole?: RoleName;
}
