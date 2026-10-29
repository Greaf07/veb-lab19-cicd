import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Req, UseGuards } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../roles/roles.guard';
import { Roles } from '../roles/roles.decorator';
import { RoleName } from '../roles/role-name.enum';
import type { RequestWithUser } from '../auth/auth-user.interface';

@Controller('tasks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getAllTasks(@Req() request: RequestWithUser) {
    return this.tasksService.getAllTasks(request.user);
  }

  @Get('user/:userId')
  getTasksByUser(@Param('userId', ParseIntPipe) userId: number, @Req() request: RequestWithUser) {
    return this.tasksService.getTasksByUser(userId, request.user);
  }

  @Get(':id')
  getTaskById(@Param('id', ParseIntPipe) id: number, @Req() request: RequestWithUser) {
    return this.tasksService.getTaskById(id, request.user);
  }

  @Post()
  createTask(@Body() dto: CreateTaskDto, @Req() request: RequestWithUser) {
    return this.tasksService.createTask(dto, request.user);
  }

  @Patch(':id')
  updateTask(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto, @Req() request: RequestWithUser) {
    return this.tasksService.updateTask(id, dto, request.user);
  }

  @Put(':id')
  replaceTask(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto, @Req() request: RequestWithUser) {
    return this.tasksService.updateTask(id, dto, request.user);
  }

  @Delete(':id')
  @Roles(RoleName.Administrator)
  @HttpCode(204)
  deleteTask(@Param('id', ParseIntPipe) id: number, @Req() request: RequestWithUser) {
    return this.tasksService.deleteTask(id, request.user);
  }
}
