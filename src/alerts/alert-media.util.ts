export type MediaKind = 'image' | 'audio';

export interface DetectedMedia {
  kind: MediaKind;
  ext: string;
}

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  bytes.every((byte, index) => buffer[offset + index] === byte);

const ascii = (buffer: Buffer, offset: number, length: number): string =>
  buffer.subarray(offset, offset + length).toString('latin1');

/**
 * Identifica el tipo real del archivo por sus primeros bytes (no por la extensión ni el
 * Content-Type, que el cliente controla). Solo se aceptan formatos de imagen y audio seguros.
 */
export function detectMedia(buffer: Buffer): DetectedMedia | null {
  if (buffer.length < 12) {
    return null;
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47])) {
    return { kind: 'image', ext: 'png' };
  }
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return { kind: 'image', ext: 'jpg' };
  }
  if (ascii(buffer, 0, 4) === 'GIF8') {
    return { kind: 'image', ext: 'gif' };
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WEBP') {
    return { kind: 'image', ext: 'webp' };
  }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 4) === 'WAVE') {
    return { kind: 'audio', ext: 'wav' };
  }
  if (ascii(buffer, 0, 4) === 'OggS') {
    return { kind: 'audio', ext: 'ogg' };
  }
  if (ascii(buffer, 0, 3) === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return { kind: 'audio', ext: 'mp3' };
  }
  return null;
}

/** Nombre de archivo válido para servir: UUID + extensión permitida (evita path traversal). */
export const MEDIA_FILE_PATTERN = /^[a-f0-9-]{36}\.(png|jpg|gif|webp|mp3|wav|ogg)$/;
