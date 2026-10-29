import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleName } from '../roles/role-name.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(RoleName.Administrator)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  getAllUsers() {
    return this.usersService.getAllUsers();
  }

  @Get(':id')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.toPublicUser(await this.usersService.getUserById(id));
  }

  @Patch(':id')
  updateUser(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUserDto) {
    return this.usersService.updateUser(id, dto);
  }

  @Put(':id/roles')
  updateRoles(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateRolesDto) {
    return this.usersService.updateRoles(id, dto.roles);
  }

  @Delete(':id')
  @HttpCode(204)
  deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.deleteUser(id);
  }
}
