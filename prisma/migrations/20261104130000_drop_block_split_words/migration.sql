-- La detección de palabras partidas pasa a ser por palabra (modo "contains"), ya no un ajuste global.
ALTER TABLE "app_settings" DROP COLUMN "blockSplitWords";
