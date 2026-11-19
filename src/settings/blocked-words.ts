/**
 * Detección de palabras prohibidas resistente a las trampas habituales del chat:
 * mayúsculas, tildes, letras estiradas ("maaaricon"), leet ("m4r1c0n"), letras sueltas
 * ("m a r i c o n", "m.a.r.i.c.o.n"), palabras partidas ("mar i con") y faltas a propósito
 * ("mary kon", "marikon"). Todo se compara en una forma normalizada, tanto el mensaje como la lista.
 */

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
  '@': 'a',
  $: 's',
  '!': 'i',
  '|': 'i',
  '¡': 'i',
};

/** Forma "fonética" de una palabra: k/q→c, z→s, y→i, v→b, w→u, sin h y sin letras repetidas. */
function normalizeWord(word: string): string {
  return word
    .replace(/[kq]/g, 'c')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/v/g, 'b')
    .replace(/w/g, 'u')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
}

/** Divide el texto en palabras normalizadas; las letras sueltas consecutivas se unen en una sola. */
export function tokenize(text: string): string[] {
  const folded = [...text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]
    .map((char) => LEET[char] ?? char)
    .join('');

  const merged: string[] = [];
  let singles = '';
  for (const raw of folded.split(/[^a-z]+/)) {
    if (raw.length === 1) {
      singles += raw;
      continue;
    }
    if (singles) {
      merged.push(singles);
      singles = '';
    }
    if (raw) {
      merged.push(raw);
    }
  }
  if (singles) {
    merged.push(singles);
  }
  return merged.map(normalizeWord).filter(Boolean);
}

export type MatchMode = 'contains' | 'exact';

export interface BlockedWordRule {
  word: string;
  matchMode: MatchMode;
}

interface CompiledRule extends BlockedWordRule {
  /** La palabra o frase normalizada, una entrada por palabra ("negro de mierda" → 3). */
  parts: string[];
  joined: string;
}

/** Por debajo de esto no se prueban uniones de palabras sueltas (evita falsos positivos). */
const SPLIT_MIN_LENGTH = 5;

export class BlockedWordMatcher {
  private readonly rules: CompiledRule[];

  constructor(rules: readonly BlockedWordRule[]) {
    this.rules = rules
      .map((rule) => {
        const parts = tokenize(rule.word);
        return { ...rule, parts, joined: parts.join('') };
      })
      .filter((rule) => rule.joined.length > 0);
  }

  /** Devuelve la primera regla que coincide con el texto, o null si el texto está limpio. */
  findMatch(text: string): BlockedWordRule | null {
    const tokens = tokenize(text);
    if (tokens.length === 0) {
      return null;
    }

    const joined = tokens.join('');
    const starts = new Set<number>();
    const ends = new Set<number>();
    let offset = 0;
    for (const token of tokens) {
      starts.add(offset);
      offset += token.length;
      ends.add(offset);
    }

    // Solo el modo "contains" también busca la palabra partida en varias ("mar" + "con").
    const hit = this.rules.find(
      (rule) =>
        this.matchesTokens(rule, tokens) ||
        (rule.matchMode === 'contains' &&
          rule.joined.length >= SPLIT_MIN_LENGTH &&
          this.matchesAcrossTokens(rule.joined, joined, starts, ends)),
    );
    return hit ? { word: hit.word, matchMode: hit.matchMode } : null;
  }

  isBlocked(text: string): boolean {
    return this.findMatch(text) !== null;
  }

  /** Las palabras de la regla aparecen seguidas en el mensaje, completas o contenidas según el modo. */
  private matchesTokens(rule: CompiledRule, tokens: string[]): boolean {
    const same = (token: string, part: string): boolean =>
      rule.matchMode === 'exact' ? token === part : token.includes(part);
    for (let i = 0; i + rule.parts.length <= tokens.length; i++) {
      if (rule.parts.every((part, j) => same(tokens[i + j], part))) {
        return true;
      }
    }
    return false;
  }

  /** La palabra aparece al unir palabras vecinas, empezando y terminando en límites de palabra. */
  private matchesAcrossTokens(word: string, joined: string, starts: Set<number>, ends: Set<number>): boolean {
    let index = joined.indexOf(word);
    while (index !== -1) {
      if (starts.has(index) && ends.has(index + word.length)) {
        return true;
      }
      index = joined.indexOf(word, index + 1);
    }
    return false;
  }
}
