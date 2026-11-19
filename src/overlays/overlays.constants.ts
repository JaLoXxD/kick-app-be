/** Overlays de texto con "el último …" de Kick; cada tipo tiene su propia fila de configuración. */
export const LAST_EVENT_TYPES = ['follower', 'subscriber'] as const;
export type LastEventType = (typeof LAST_EVENT_TYPES)[number];

/** Texto inicial de cada overlay; {usuario} se reemplaza por el último usuario. */
export const LAST_EVENT_DEFAULTS: Record<LastEventType, { textTemplate: string }> = {
  follower: { textTemplate: 'Último seguidor: {usuario}' },
  subscriber: { textTemplate: 'Último suscriptor: {usuario}' },
};

export const OverlaysInternalEvent = {
  UPDATE: 'overlays.update',
  SESSION: 'overlays.session',
  DONORS: 'overlays.donors',
  ROTATOR: 'overlays.rotator',
} as const;

export const WIDGET_ID = 'main';

/** Paneles que puede alternar el rotador. */
export const ROTATOR_ITEMS = ['follower', 'subscriber', 'donors', 'session'] as const;
export const DONOR_PERIODS = ['all', 'month', 'week', 'session'] as const;
export type DonorPeriod = (typeof DONOR_PERIODS)[number];

/** Los KICKs anónimos no se pueden sumar a nadie, así que no entran al top. */
export const ANONYMOUS_DONOR = 'Anónimo';
