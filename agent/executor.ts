/**
 * HumanMandate agent executor (Phase 0).
 *
 * Authority: HumanMandate on World Chain mainnet (480) — authorize by humanId,
 * pull as AgentBook-backed agent, revoke as payer.
 *
 * Usage:
 *   bun run executor.ts status
 *   bun run executor.ts authorize <humanId> <dailyCapWei>
 *   bun run executor.ts pull <amountWei>
 *   bun run executor.ts revoke
 *
 * Env: USER_KEY (payer), AGENT_KEY (agent), RPC_URL, MANDATE, TOKEN, RECIPIENT
 * Optional: CHAIN_ID (default 480)
 */
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const abi = parseAbi([
  'function authorize(uint256 humanId, address token, uint128 dailyCap, address recipient)',
  'function revoke()',
  'function pull(address payer, uint256 amount)',
  'function mandates(address) view returns (uint256 humanId, address token, address recipient, uint128 dailyCap, uint128 spentToday, uint64 day, bool active)',
]);

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing ${k}`);
  return v;
};

const rpc = env('RPC_URL');
const transport = http(rpc);
const publicClient = createPublicClient({ transport });
const chainId = Number(process.env.CHAIN_ID ?? 480);
const chain = defineChain({
  id: chainId,
  name: chainId === 480 ? 'worldchain' : `chain-${chainId}`,
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const mandate = env('MANDATE') as `0x${string}`;

async function main() {
  const [mode, a, b] = process.argv.slice(2);
  const user = privateKeyToAccount(env('USER_KEY') as `0x${string}`);
  const agent = privateKeyToAccount(env('AGENT_KEY') as `0x${string}`);

  if (mode === 'authorize') {
    if (!a || !b) throw new Error('authorize <humanId> <dailyCapWei>');
    const wallet = createWalletClient({ account: user, chain, transport });
    const tx = await wallet.writeContract({
      address: mandate,
      abi,
      functionName: 'authorize',
      args: [
        BigInt(a),
        env('TOKEN') as `0x${string}`,
        BigInt(b),
        env('RECIPIENT') as `0x${string}`,
      ],
    });
    console.log('authorize tx:', tx, (await publicClient.waitForTransactionReceipt({ hash: tx })).status);
  } else if (mode === 'pull') {
    const wallet = createWalletClient({ account: agent, chain, transport });
    const tx = await wallet.writeContract({
      address: mandate,
      abi,
      functionName: 'pull',
      args: [user.address, BigInt(a ?? '2000000000000000000')],
    });
    console.log('pull tx:', tx, (await publicClient.waitForTransactionReceipt({ hash: tx })).status);
  } else if (mode === 'revoke') {
    const wallet = createWalletClient({ account: user, chain, transport });
    const tx = await wallet.writeContract({
      address: mandate,
      abi,
      functionName: 'revoke',
      args: [],
    });
    console.log('revoke tx:', tx, (await publicClient.waitForTransactionReceipt({ hash: tx })).status);
  } else if (mode === 'status') {
    const m = await publicClient.readContract({
      address: mandate,
      abi,
      functionName: 'mandates',
      args: [user.address],
    });
    console.log(
      `humanId=${m[0]} token=${m[1]} recipient=${m[2]} cap=${m[3]} spentToday=${m[4]} active=${m[6]}`,
    );
  } else {
    throw new Error('mode: authorize|pull|revoke|status');
  }
}

main().catch((e: { shortMessage?: string; message?: string }) => {
  console.error(e.shortMessage ?? e.message);
  process.exit(1);
});
