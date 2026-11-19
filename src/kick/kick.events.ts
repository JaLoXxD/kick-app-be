/** Nombres de los eventos internos publicados vía EventEmitter2. */
export const KickInternalEvent = {
  CHAT: 'kick.chat',
  FOLLOW: 'kick.follow',
  KICKS: 'kick.kicks',
  SUBSCRIPTION: 'kick.subscription',
  GIFT_SUBSCRIPTION: 'kick.gift-subscription',
  STATUS: 'kick.status',
} as const;

export interface KickChatEvent {
  messageId: string;
  username: string;
  text: string;
  /** Tipos de insignia del usuario en el chat ("subscriber", "moderator", "broadcaster"...). */
  badges?: string[];
}

export interface KickFollowEvent {
  username: string;
}

/** Alguien envió KICKs (propinas de Kick). */
export interface KickKicksEvent {
  username: string;
  amount: number;
}

/** Suscripción nueva. */
export interface KickSubscriptionEvent {
  username: string;
}

/** Alguien regaló una o varias suscripciones. */
export interface KickGiftSubscriptionEvent {
  username: string;
  amount: number;
}

export interface KickStatusEvent {
  authenticated: boolean;
  subscribed: boolean;
  message?: string;
}

/** Payload de `chat.message.sent` (v1), solo los campos que usamos. */
export interface KickChatWebhookPayload {
  message_id: string;
  content: string;
  sender: {
    username: string;
    is_anonymous?: boolean;
    identity?: { badges?: { type?: string }[] | null } | null;
  };
}

/** Payload de `channel.followed` (v1), solo los campos que usamos. */
export interface KickFollowWebhookPayload {
  follower: { username: string };
}

/** Payload de `kicks.gifted` (v1), solo los campos que usamos. */
export interface KickKicksWebhookPayload {
  sender?: { username?: string | null; is_anonymous?: boolean } | null;
  gift?: { amount?: number };
}

/** Payload de `channel.subscription.new` (v1), solo los campos que usamos. */
export interface KickSubscriptionNewWebhookPayload {
  subscriber?: { username?: string | null } | null;
}

/** Payload de `channel.subscription.gifts` (v1), solo los campos que usamos. */
export interface KickGiftSubscriptionWebhookPayload {
  gifter?: { username?: string | null; is_anonymous?: boolean } | null;
  giftees?: unknown[] | null;
}
