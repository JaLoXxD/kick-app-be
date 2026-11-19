import { Injectable } from '@nestjs/common';

/** Cuenta los caracteres sintetizados hoy (comentarios y alertas comparten el mismo tope diario). */
@Injectable()
export class SpendTrackerService {
  private chars = 0;
  private dayKey = this.todayKey();

  /** Reserva `count` caracteres si caben bajo `dailyCap`; devuelve false si se pasaría del tope. */
  tryConsume(count: number, dailyCap: number): boolean {
    const key = this.todayKey();
    if (key !== this.dayKey) {
      this.dayKey = key;
      this.chars = 0;
    }
    if (this.chars + count > dailyCap) {
      return false;
    }
    this.chars += count;
    return true;
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
