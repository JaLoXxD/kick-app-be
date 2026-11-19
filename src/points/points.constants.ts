export const PointsInternalEvent = {
  /** Una tirada de la ruleta terminó (la usa el overlay de OBS para animarla). */
  SPIN: 'points.spin',
} as const;

export interface SpinEvent {
  id: string;
  username: string;
  bet: number;
  /** Lo que pagó la ruleta (apuesta × multiplicador). */
  payout: number;
  /** Ganancia neta: payout − apuesta (negativa si pierde). */
  net: number;
  balance: number;
  pointsName: string;
  /** Sectores de la ruleta (solo los que tienen probabilidad), en orden. */
  outcomes: { label: string; multiplier: number; weight: number }[];
  /** Sector en el que cae. */
  index: number;
}
