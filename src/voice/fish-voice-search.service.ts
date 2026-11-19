import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';

const FISH_MODELS_URL = 'https://api.fish.audio/model';
const PAGE_SIZE = 12;
/** Fish devuelve las portadas como ruta relativa (coverimage/<id>); se sirven desde este CDN. */
const FISH_ASSETS_URL = 'https://public-platform.r2.fish.audio';

export interface FishVoiceResult {
  id: string;
  title: string;
  description: string;
  coverImage: string;
  languages: string[];
  author: string;
  likeCount: number;
  /** URL de un audio de muestra de la voz, si tiene. */
  sampleAudioUrl: string | null;
}

export interface FishVoiceSearchPage {
  items: FishVoiceResult[];
  hasMore: boolean;
}

interface FishModelItem {
  _id: string;
  title: string;
  description?: string;
  cover_image?: string;
  languages?: string[];
  author?: { nickname?: string };
  like_count?: number;
  samples?: { audio?: string }[];
}

/** Busca voces públicas en la biblioteca de Fish Audio con la API key del servidor. */
@Injectable()
export class FishVoiceSearchService {
  constructor(private readonly configService: ConfigService<AppConfig, true>) {}

  async search(query: string, language: string, page: number): Promise<FishVoiceSearchPage> {
    const apiKey = this.configService.get('tts.fishApiKey', { infer: true });
    if (!apiKey) {
      throw new ServiceUnavailableException('FISH_API_KEY no está configurada');
    }

    const params = new URLSearchParams({
      page_size: String(PAGE_SIZE),
      page_number: String(page),
      // Sin texto se listan las más usadas; con texto, las más relevantes.
      sort_by: query ? 'score' : 'task_count',
    });
    if (query) {
      params.set('title', query);
    }
    if (language) {
      params.set('language', language);
    }

    const response = await fetch(`${FISH_MODELS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      throw new ServiceUnavailableException(`Fish Audio respondió ${response.status} al buscar voces`);
    }

    const body = (await response.json()) as { items?: FishModelItem[]; has_more?: boolean | null };
    return {
      items: (body.items ?? []).map((item) => ({
        id: item._id,
        title: item.title,
        description: item.description ?? '',
        coverImage: this.toAbsoluteUrl(item.cover_image),
        languages: item.languages ?? [],
        author: item.author?.nickname ?? '',
        likeCount: item.like_count ?? 0,
        sampleAudioUrl: item.samples?.find((sample) => sample.audio)?.audio ?? null,
      })),
      hasMore: body.has_more ?? false,
    };
  }

  private toAbsoluteUrl(path: string | undefined): string {
    if (!path) {
      return '';
    }
    return /^https?:\/\//.test(path) ? path : `${FISH_ASSETS_URL}/${path.replace(/^\//, '')}`;
  }
}
