import { Injectable, NotFoundException } from '@nestjs/common';
import { UserVoiceMapping, VoiceProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TtsVoiceOptions } from '../tts/tts.provider';
import { AssignVoiceDto } from './dto/assign-voice.dto';

/** Se usa únicamente si no hay ninguna voz marcada como isDefault en la base de datos. */
export interface ResolvedVoice extends TtsVoiceOptions {
  voiceName: string;
  /** Volumen propio del usuario (0-100); 100 si no tiene asignación. */
  volume: number;
}

@Injectable()
export class VoiceAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveVoiceForUser(kickUsername: string): Promise<ResolvedVoice> {
    const mapping = await this.prisma.userVoiceMapping.findUnique({
      where: { kickUsername: kickUsername.toLowerCase() },
      include: { voiceProfile: true },
    });
    if (mapping) {
      return this.toResolvedVoice(mapping.voiceProfile, mapping.volume);
    }

    const defaultVoice = await this.prisma.voiceProfile.findFirst({
      where: { isDefault: true },
    });
    if (defaultVoice) {
      return this.toResolvedVoice(defaultVoice);
    }

    throw new NotFoundException('No hay ninguna voz por defecto configurada');
  }

  listAssignments(): Promise<(UserVoiceMapping & { voiceProfile: VoiceProfile })[]> {
    return this.prisma.userVoiceMapping.findMany({
      include: { voiceProfile: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assign(dto: AssignVoiceDto): Promise<UserVoiceMapping> {
    const voiceProfile = await this.prisma.voiceProfile.findUnique({
      where: { id: dto.voiceProfileId },
    });
    if (!voiceProfile) {
      throw new NotFoundException(`No existe la voz ${dto.voiceProfileId}`);
    }

    const kickUsername = dto.kickUsername.replace(/^@/, '').toLowerCase();
    return this.prisma.userVoiceMapping.upsert({
      where: { kickUsername },
      create: { kickUsername, voiceProfileId: dto.voiceProfileId, volume: dto.volume ?? 100 },
      update: { voiceProfileId: dto.voiceProfileId, volume: dto.volume },
    });
  }

  async unassign(kickUsername: string): Promise<void> {
    const username = kickUsername.replace(/^@/, '').toLowerCase();
    await this.prisma.userVoiceMapping.delete({ where: { kickUsername: username } }).catch(() => {
      throw new NotFoundException(`No hay una voz asignada a @${username}`);
    });
  }

  private toResolvedVoice(voiceProfile: VoiceProfile, volume = 100): ResolvedVoice {
    return {
      voiceName: voiceProfile.name,
      volume,
      fishVoiceId: voiceProfile.fishVoiceId,
      speed: voiceProfile.speed,
      pitch: voiceProfile.pitch,
    };
  }
}
