import { Injectable, NotFoundException } from '@nestjs/common';
import { VoiceProfile } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';

@Injectable()
export class VoiceProfileService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(): Promise<VoiceProfile[]> {
    return this.prisma.voiceProfile.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findOneOrFail(id: string): Promise<VoiceProfile> {
    const voice = await this.prisma.voiceProfile.findUnique({ where: { id } });
    if (!voice) {
      throw new NotFoundException(`No existe la voz ${id}`);
    }
    return voice;
  }

  async create(dto: CreateVoiceProfileDto): Promise<VoiceProfile> {
    if (dto.isDefault) {
      await this.clearDefaultFlag();
    }
    return this.prisma.voiceProfile.create({
      data: {
        name: dto.name,
        fishVoiceId: dto.fishVoiceId,
        speed: dto.speed,
        pitch: dto.pitch,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async update(id: string, dto: UpdateVoiceProfileDto): Promise<VoiceProfile> {
    await this.findOneOrFail(id);
    if (dto.isDefault) {
      await this.clearDefaultFlag();
    }
    return this.prisma.voiceProfile.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOneOrFail(id);
    await this.prisma.voiceProfile.delete({ where: { id } });
  }

  private async clearDefaultFlag(): Promise<void> {
    await this.prisma.voiceProfile.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    });
  }
}
