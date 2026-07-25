import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Replay protection (integrate.md Step 6): the Portal proves cryptographic validity;
 * we must reject nullifiers we've already accepted. Hackathon-grade JSON file store —
 * swap for Postgres NUMERIC(78,0) in production.
 */
const STORE_PATH = process.env.VERCEL
  ? '/tmp/nullifiers.json'
  : join(process.cwd(), 'nullifiers.json');

async function load(): Promise<Record<string, string>> {
  try {
    return JSON.parse(await readFile(STORE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export async function isNullifierUsed(nullifier: string): Promise<boolean> {
  const store = await load();
  return BigInt(nullifier).toString() in store;
}

export async function markNullifierUsed(nullifier: string, wallet: string): Promise<void> {
  const store = await load();
  store[BigInt(nullifier).toString()] = wallet;
  await writeFile(STORE_PATH, JSON.stringify(store, null, 2));
}
