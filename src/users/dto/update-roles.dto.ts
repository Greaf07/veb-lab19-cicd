import { ArrayMinSize, ArrayUnique, IsArray, IsEnum } from 'class-validator';
import { RoleName } from '../../roles/role-name.enum';

export class UpdateRolesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(RoleName, { each: true })
  roles: RoleName[];
}
