import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../config/configuration';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly jwtService: JwtService,
  ) {}

  async login(password: string): Promise<string> {
    const { adminPassword } = this.configService.get('auth', { infer: true });
    if (!adminPassword) {
      throw new ServiceUnavailableException('ADMIN_PASSWORD no está configurada');
    }
    if (!this.safeEqual(password, adminPassword)) {
      throw new UnauthorizedException('Contraseña incorrecta');
    }
    return this.jwtService.signAsync({ role: 'admin' });
  }

  async verifyAdminToken(token: string | undefined): Promise<boolean> {
    if (!token) {
      return false;
    }
    try {
      const payload = await this.jwtService.verifyAsync<{ role?: string }>(token);
      return payload.role === 'admin';
    } catch {
      return false;
    }
  }

  isValidOverlayToken(token: string | undefined): boolean {
    const { overlayToken } = this.configService.get('auth', { infer: true });
    return !!token && !!overlayToken && this.safeEqual(token, overlayToken);
  }

  getOverlayToken(): string {
    const { overlayToken } = this.configService.get('auth', { infer: true });
    if (!overlayToken) {
      throw new ServiceUnavailableException('OVERLAY_TOKEN no está configurado');
    }
    return overlayToken;
  }

  private safeEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a);
    const bufferB = Buffer.from(b);
    return bufferA.length === bufferB.length && timingSafeEqual(bufferA, bufferB);
  }
}
