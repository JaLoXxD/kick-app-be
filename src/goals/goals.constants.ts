/** Metas disponibles: cada una es una fila de `goal_configs` con ese id. */
export const GOAL_IDS = ['follow', 'kicks', 'subs'] as const;
export type GoalId = (typeof GOAL_IDS)[number];
export const FOLLOW_GOAL_ID: GoalId = 'follow';

export const isGoalId = (value: string): value is GoalId => (GOAL_IDS as readonly string[]).includes(value);

/** Valores iniciales propios de cada meta (el resto usa los de la tabla). */
export const GOAL_DEFAULTS: Record<GoalId, { goalCount: number; textTemplate: string; barColor?: string; barColor2?: string }> = {
  follow: { goalCount: 100, textTemplate: 'Meta de seguidores: {actual}/{meta}' },
  kicks: { goalCount: 1000, textTemplate: 'Meta de KICKs: {actual}/{meta}', barColor: '#53fc18', barColor2: '#b6ff3d' },
  subs: { goalCount: 50, textTemplate: 'Meta de suscriptores: {actual}/{meta}', barColor: '#a970ff', barColor2: '#ff70d6' },
};

export const GoalsInternalEvent = {
  UPDATE: 'goals.update',
} as const;
