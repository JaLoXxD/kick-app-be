import { Global, Module } from '@nestjs/common';
import { BlockedWordsController } from './blocked-words.controller';
import { BlockedWordsService } from './blocked-words.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Global()
@Module({
  controllers: [SettingsController, BlockedWordsController],
  providers: [SettingsService, BlockedWordsService],
  exports: [SettingsService, BlockedWordsService],
})
export class SettingsModule {}
