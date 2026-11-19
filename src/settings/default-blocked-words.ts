/**
 * Lista base de palabras y frases que casi seguro llevarían a un ban en Kick (discurso de odio,
 * insultos discriminatorios, incitación a la violencia o al suicidio, contenido sexual con menores).
 * Se escribe normal, con tildes o sin ellas: el filtro compara versiones normalizadas, así que
 * también atrapa variantes como "m4ric0n", "mary kon", "m a r i c o n" o "maaaricon".
 *
 * Es deliberadamente corta en groserías comunes ("puto", "mierda"…): bloquearlas haría callar
 * demasiado chat sin que Kick lo sancione. Las que quieras añadir van en el cuadro del dashboard.
 */
export const DEFAULT_BLOCKED_WORDS: readonly string[] = [
  // Insultos homófobos / transfóbicos
  'maricón',
  'maricones',
  'marimacha',
  'mariposón',
  'joto',
  'jotos',
  'travelo',
  'trolo',
  'sarasa',
  'faggot',
  'faggots',
  'fag',
  'tranny',
  'trannies',
  // Insultos racistas / xenófobos
  'nigger',
  'niggers',
  'nigga',
  'niggas',
  'negrata',
  'sudaca',
  'sudacas',
  'negro de mierda',
  'indio de mierda',
  'chino de mierda',
  'moro de mierda',
  'gitano de mierda',
  'sucio negro',
  'chink',
  'gook',
  'spic',
  'wetback',
  'beaner',
  'kike',
  'kikes',
  'coon',
  'paki',
  // Antisemitismo y apología nazi
  'judío de mierda',
  'sucio judío',
  'holohoax',
  'sieg heil',
  'heil hitler',
  'hitler tenía razón',
  'hitler tenia razon',
  'gas the jews',
  'gasear judíos',
  'gasear a los judíos',
  // Capacitismo
  'mongólico',
  'mongolico',
  'mongólica',
  'mongolo',
  'retard',
  'retarded',
  // Incitación al suicidio / autolesión
  'suicídate',
  'suicidate',
  'mátate',
  'matate',
  'kys',
  'kill yourself',
  'ojalá te mueras',
  'ojala te mueras',
  'ojalá te mueras de cáncer',
  'córtate las venas',
  'cortate las venas',
  'ahórcate',
  'ahorcate',
  // Amenazas y violencia sexual
  'te voy a violar',
  'te voy a matar',
  'ojalá te violen',
  'ojala te violen',
  'violala',
  'violarte',
  'violarla',
  // Contenido sexual con menores
  'child porn',
  'childporn',
  'porno infantil',
  'pornografía infantil',
  'pornografia infantil',
  'cheese pizza',
  'nudes de menores',
  'menores desnudos',
  'pasame cp',
  'pasa cp',
  'vendo cp',
];

export type BlockedWordMatchMode = 'contains' | 'exact';

/**
 * Modo con el que entra cada palabra de la lista base: las cortas solo como palabra completa
 * (evita falsos positivos como "Nigeria" por "niger"); las largas y distintivas, dentro de cualquier palabra.
 */
export function defaultMatchMode(word: string): BlockedWordMatchMode {
  return word.replace(/\s+/g, '').length >= 7 ? 'contains' : 'exact';
}
