import { Body, Controller, Get, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { GoalConfig } from '@prisma/client';
import { AdminGuard } from '../auth/admin.guard';
import { UpdateGoalConfigDto } from './dto/update-goal-config.dto';
import { GoalId, isGoalId } from './goals.constants';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(AdminGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  /** `follow` (seguidores), `kicks` o `subs`. */
  @Get(':id')
  getConfig(@Param('id') id: string): Promise<GoalConfig> {
    return this.goalsService.getConfig(this.goalId(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGoalConfigDto): Promise<GoalConfig> {
    return this.goalsService.update(this.goalId(id), dto);
  }

  private goalId(id: string): GoalId {
    if (!isGoalId(id)) {
      throw new NotFoundException(`No existe la meta "${id}"`);
    }
    return id;
  }
}
