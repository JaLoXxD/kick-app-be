import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg(process.env.DATABASE_URL ?? '') });

// Voz de la biblioteca de Fish Audio (URL: fish.audio/es/app/m/<id>).
const VOICES = [
  { name: 'Jorge Loquendo', fishVoiceId: '1a6e65b87ea0490d8713bbc058997633', speed: 1, isDefault: true },
];

async function main(): Promise<void> {
  for (const voice of VOICES) {
    await prisma.voiceProfile.upsert({
      where: { name: voice.name },
      create: voice,
      update: {},
    });
  }
  console.log(`Seed completado: ${VOICES.length} voz(es) de ejemplo.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
