import { Module } from '@nestjs/common';
import { KickModule } from '../kick/kick.module';
import { SpotifyApiService } from './spotify-api.service';
import { SpotifyAuthService } from './spotify-auth.service';
import { SpotifyController } from './spotify.controller';
import { SpotifyService } from './spotify.service';

@Module({
  imports: [KickModule],
  controllers: [SpotifyController],
  providers: [SpotifyAuthService, SpotifyApiService, SpotifyService],
  exports: [SpotifyService],
})
export class SpotifyModule {}
