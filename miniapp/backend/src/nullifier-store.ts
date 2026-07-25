/// Replay protection per World docs (integrate.md Step 6): the Portal proves the proof is
/// cryptographically valid; WE must reject nullifiers we've already accepted.
/// Hackathon-grade persistence: JSON file next to the process. Swap for Postgres NUMERIC(78,0) in prod.
const STORE_PATH = new URL("../nullifiers.json", import.meta.url).pathname;

async function load(): Promise<Record<string, string>> {
  try {
    return await Bun.file(STORE_PATH).json();
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
  await Bun.write(STORE_PATH, JSON.stringify(store, null, 2));
}
