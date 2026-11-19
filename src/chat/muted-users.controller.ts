import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { MutedUser } from '@prisma/client';
import { IsString, Matches, MaxLength } from 'class-validator';
import { AdminGuard } from '../auth/admin.guard';
import { MutedUsersService } from './muted-users.service';

class MuteUserDto {
  @IsString()
  @Matches(/^@?[\w .-]{1,64}$/, { message: 'username inválido' })
  @MaxLength(65)
  kickUsername!: string;
}

@Controller('chat/muted')
@UseGuards(AdminGuard)
export class MutedUsersController {
  constructor(private readonly mutedUsers: MutedUsersService) {}

  @Get()
  list(): Promise<MutedUser[]> {
    return this.mutedUsers.list();
  }

  @Post()
  mute(@Body() dto: MuteUserDto): Promise<MutedUser> {
    return this.mutedUsers.mute(dto.kickUsername);
  }

  @Delete(':username')
  @HttpCode(HttpStatus.NO_CONTENT)
  unmute(@Param('username') username: string): Promise<void> {
    return this.mutedUsers.unmute(username);
  }
}
