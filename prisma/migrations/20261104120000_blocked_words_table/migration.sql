-- CreateTable
CREATE TABLE "blocked_words" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "matchMode" TEXT NOT NULL DEFAULT 'exact',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blocked_words_word_key" ON "blocked_words"("word");

-- Las palabras propias que ya había se conservan tal cual (se buscaban dentro de cualquier palabra)
INSERT INTO "blocked_words" ("id", "word", "matchMode", "builtin")
SELECT gen_random_uuid()::text, lower(trim(w)), 'contains', false
FROM "app_settings", unnest("blockedWords") AS w
WHERE trim(w) <> ''
ON CONFLICT ("word") DO NOTHING;

-- Lista base (puede editarse, desactivarse o borrarse desde el dashboard)
INSERT INTO "blocked_words" ("id", "word", "matchMode", "builtin") VALUES
  (gen_random_uuid()::text, 'maricón', 'contains', true),
  (gen_random_uuid()::text, 'maricones', 'contains', true),
  (gen_random_uuid()::text, 'marimacha', 'contains', true),
  (gen_random_uuid()::text, 'mariposón', 'contains', true),
  (gen_random_uuid()::text, 'joto', 'exact', true),
  (gen_random_uuid()::text, 'jotos', 'exact', true),
  (gen_random_uuid()::text, 'travelo', 'contains', true),
  (gen_random_uuid()::text, 'trolo', 'exact', true),
  (gen_random_uuid()::text, 'sarasa', 'exact', true),
  (gen_random_uuid()::text, 'faggot', 'exact', true),
  (gen_random_uuid()::text, 'faggots', 'contains', true),
  (gen_random_uuid()::text, 'fag', 'exact', true),
  (gen_random_uuid()::text, 'tranny', 'exact', true),
  (gen_random_uuid()::text, 'trannies', 'contains', true),
  (gen_random_uuid()::text, 'nigger', 'exact', true),
  (gen_random_uuid()::text, 'niggers', 'contains', true),
  (gen_random_uuid()::text, 'nigga', 'exact', true),
  (gen_random_uuid()::text, 'niggas', 'exact', true),
  (gen_random_uuid()::text, 'negrata', 'contains', true),
  (gen_random_uuid()::text, 'sudaca', 'exact', true),
  (gen_random_uuid()::text, 'sudacas', 'contains', true),
  (gen_random_uuid()::text, 'negro de mierda', 'contains', true),
  (gen_random_uuid()::text, 'indio de mierda', 'contains', true),
  (gen_random_uuid()::text, 'chino de mierda', 'contains', true),
  (gen_random_uuid()::text, 'moro de mierda', 'contains', true),
  (gen_random_uuid()::text, 'gitano de mierda', 'contains', true),
  (gen_random_uuid()::text, 'sucio negro', 'contains', true),
  (gen_random_uuid()::text, 'chink', 'exact', true),
  (gen_random_uuid()::text, 'gook', 'exact', true),
  (gen_random_uuid()::text, 'spic', 'exact', true),
  (gen_random_uuid()::text, 'wetback', 'contains', true),
  (gen_random_uuid()::text, 'beaner', 'exact', true),
  (gen_random_uuid()::text, 'kike', 'exact', true),
  (gen_random_uuid()::text, 'kikes', 'exact', true),
  (gen_random_uuid()::text, 'coon', 'exact', true),
  (gen_random_uuid()::text, 'paki', 'exact', true),
  (gen_random_uuid()::text, 'judío de mierda', 'contains', true),
  (gen_random_uuid()::text, 'sucio judío', 'contains', true),
  (gen_random_uuid()::text, 'holohoax', 'contains', true),
  (gen_random_uuid()::text, 'sieg heil', 'contains', true),
  (gen_random_uuid()::text, 'heil hitler', 'contains', true),
  (gen_random_uuid()::text, 'hitler tenía razón', 'contains', true),
  (gen_random_uuid()::text, 'hitler tenia razon', 'contains', true),
  (gen_random_uuid()::text, 'gas the jews', 'contains', true),
  (gen_random_uuid()::text, 'gasear judíos', 'contains', true),
  (gen_random_uuid()::text, 'gasear a los judíos', 'contains', true),
  (gen_random_uuid()::text, 'mongólico', 'contains', true),
  (gen_random_uuid()::text, 'mongolico', 'contains', true),
  (gen_random_uuid()::text, 'mongólica', 'contains', true),
  (gen_random_uuid()::text, 'mongolo', 'contains', true),
  (gen_random_uuid()::text, 'retard', 'exact', true),
  (gen_random_uuid()::text, 'retarded', 'contains', true),
  (gen_random_uuid()::text, 'suicídate', 'contains', true),
  (gen_random_uuid()::text, 'suicidate', 'contains', true),
  (gen_random_uuid()::text, 'mátate', 'exact', true),
  (gen_random_uuid()::text, 'matate', 'exact', true),
  (gen_random_uuid()::text, 'kys', 'exact', true),
  (gen_random_uuid()::text, 'kill yourself', 'contains', true),
  (gen_random_uuid()::text, 'ojalá te mueras', 'contains', true),
  (gen_random_uuid()::text, 'ojala te mueras', 'contains', true),
  (gen_random_uuid()::text, 'ojalá te mueras de cáncer', 'contains', true),
  (gen_random_uuid()::text, 'córtate las venas', 'contains', true),
  (gen_random_uuid()::text, 'cortate las venas', 'contains', true),
  (gen_random_uuid()::text, 'ahórcate', 'contains', true),
  (gen_random_uuid()::text, 'ahorcate', 'contains', true),
  (gen_random_uuid()::text, 'te voy a violar', 'contains', true),
  (gen_random_uuid()::text, 'te voy a matar', 'contains', true),
  (gen_random_uuid()::text, 'ojalá te violen', 'contains', true),
  (gen_random_uuid()::text, 'ojala te violen', 'contains', true),
  (gen_random_uuid()::text, 'violala', 'contains', true),
  (gen_random_uuid()::text, 'violarte', 'contains', true),
  (gen_random_uuid()::text, 'violarla', 'contains', true),
  (gen_random_uuid()::text, 'child porn', 'contains', true),
  (gen_random_uuid()::text, 'childporn', 'contains', true),
  (gen_random_uuid()::text, 'porno infantil', 'contains', true),
  (gen_random_uuid()::text, 'pornografía infantil', 'contains', true),
  (gen_random_uuid()::text, 'pornografia infantil', 'contains', true),
  (gen_random_uuid()::text, 'cheese pizza', 'contains', true),
  (gen_random_uuid()::text, 'nudes de menores', 'contains', true),
  (gen_random_uuid()::text, 'menores desnudos', 'contains', true),
  (gen_random_uuid()::text, 'pasame cp', 'contains', true),
  (gen_random_uuid()::text, 'pasa cp', 'exact', true),
  (gen_random_uuid()::text, 'vendo cp', 'contains', true)
ON CONFLICT ("word") DO NOTHING;

-- AlterTable
ALTER TABLE "app_settings" DROP COLUMN "blockedWords",
DROP COLUMN "useDefaultBlockedWords";
