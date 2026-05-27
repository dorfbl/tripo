import app from './app';
import { config } from './config/env';
import { prisma } from './lib/prisma';

async function main() {
  try {
    await prisma.$connect();
    console.log('✅ התחברות למסד הנתונים הצליחה');
  } catch (err) {
    console.error('❌ שגיאה בהתחברות למסד הנתונים:', err);
    process.exit(1);
  }

  app.listen(config.port, () => {
    console.log(`🚀 השרת פועל על פורט ${config.port}`);
  });
}

main();
