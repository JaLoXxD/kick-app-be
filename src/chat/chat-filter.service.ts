import { Injectable } from '@nestjs/common';
import { MutedUsersService } from './muted-users.service';
import { BlockedWordsService } from '../settings/blocked-words.service';
import { SettingsService } from '../settings/settings.service';
import { SpendTrackerService } from '../tts/spend-tracker.service';

const URL_PATTERN = /https?:\/\/\S+|www\.\S+/gi;
/** Emotes de Kick vienen como tokens [emote:id:nombre]; no se leen en voz alta. */
const EMOTE_PATTERN = /\[emote:\d+:[^\]]*\]/g;

/** Letra (o símbolo) repetida: "mmmmmm", "jjjjj", "!!!!!". */
const REPEATED_CHAR_PATTERN = /(\S)\1+/giu;

/**
 * Decide qué comentarios se leen y limpia su texto. Todo el filtrado existe para
 * controlar el gasto de la API de TTS (se cobra por carácter sintetizado).
 */
@Injectable()
export class ChatFilterService {
  private readonly lastReadByUser = new Map<string, number>();

  constructor(
    private readonly settingsService: SettingsService,
    private readonly spendTracker: SpendTrackerService,
    private readonly mutedUsers: MutedUsersService,
    private readonly blockedWords: BlockedWordsService,
  ) {}

  /** Devuelve el texto a leer, o null si el mensaje debe ignorarse. */
  prepare(username: string, rawText: string): string | null {
    // Primero lo más barato: un usuario silenciado nunca llega a gastar caracteres ni cooldown.
    if (this.mutedUsers.isMuted(username)) {
      return null;
    }

    const config = this.settingsService.get();

    let text = rawText;
    if (config.readMode === 'command') {
      if (!text.toLowerCase().startsWith(config.command.toLowerCase())) {
        return null;
      }
      text = text.slice(config.command.length);
    }

    text = text.replace(EMOTE_PATTERN, ' ').replace(URL_PATTERN, ' ').replace(/\s+/g, ' ').trim();
    if (config.maxRepeatedChars > 0) {
      const limited = this.limitRepeatedChars(text, config.maxRepeatedChars);
      if (limited === null) {
        return null;
      }
      text = limited;
    }
    if (!text || text.length > config.maxChars) {
      return null;
    }

    if (this.blockedWords.isBlocked(text)) {
      return null;
    }

    const now = Date.now();
    const lastRead = this.lastReadByUser.get(username) ?? 0;
    if (now - lastRead < config.userCooldownSeconds * 1000) {
      return null;
    }

    if (!this.spendTracker.tryConsume(text.length, config.dailyCharCap)) {
      return null;
    }

    this.lastReadByUser.set(username, now);
    return text;
  }

  /**
   * Antispam de letras repetidas. Con "shorten" cada racha larga se acorta al máximo
   * ("mmmmmmmm" -> "mmm"); con "ignore" el mensaje se descarta (null) si alguna racha lo supera.
   * Se aplica antes de contar caracteres, así que lo acortado tampoco gasta créditos.
   */
  private limitRepeatedChars(text: string, limit: number): string | null {
    const ignore = this.settingsService.get().repeatAction === 'ignore';
    let exceeded = false;
    const shortened = text.replace(REPEATED_CHAR_PATTERN, (run, char: string) => {
      if (run.length <= limit) {
        return run;
      }
      exceeded = true;
      return char.repeat(limit);
    });
    return exceeded && ignore ? null : shortened;
  }
}
