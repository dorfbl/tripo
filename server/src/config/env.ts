import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/** Accept common aliases / accidental spacing in .env key names */
function envFirst(...names: string[]): string {
  for (const name of names) {
    const direct = process.env[name];
    if (direct?.trim()) return direct.trim();
  }
  // fallback: match keys ignoring surrounding spaces (e.g. "AVIATION ")
  for (const [k, v] of Object.entries(process.env)) {
    const cleaned = k.trim();
    if (names.includes(cleaned) && v?.trim()) return v.trim();
  }
  return '';
}

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
  jwtSecret: process.env.JWT_SECRET || 'default-secret-change-in-production',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  /** OpenAI — primary in-app AI provider (Anthropic is fallback) */
  openaiApiKey: envFirst('OPENAI_API_KEY', 'OPEN_API_KEY', 'OPENAI_KEY'),
  databaseUrl: process.env.DATABASE_URL || '',
  nodeEnv: process.env.NODE_ENV || 'development',
  googleMapsKey: envFirst(
    'GOOGLE_MAPS_KEY',
    'GOOGLE_MAPS_API_KEY',
    'VITE_GOOGLE_MAPS_KEY',
  ),
  /** AviationStack access key — used for live flight status */
  aviationstackApiKey: envFirst(
    'AVIATIONSTACK_API_KEY',
    'AVIATION_API_KEY',
    'AVIATION',
  ),
};
