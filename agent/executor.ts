/**
 * First Stock DCA agent executor (M5 runtime).
 * Authority: DcaLeash on World Chain Sepolia — the human's on-chain mandate
 * (daily cap, fixed destination, revocable). The agent can do NOTHING outside it.
 * Execution: within-mandate pulls fund the buy executor; the real-asset leg
 * (Uniswap Trading API → PAXG) runs only behind explicit TRADE_CONFIRM.
 *
 * Usage: bun run executor.ts <authorize|pull|status> [amountBaseUnits]
 * Env: USER_KEY (the human), AGENT_KEY (the agent), RPC_URL, LEASH, TOKEN, RECIPIENT
 */
import { createPublicClient, createWalletClient, defineChain, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const abi = parseAbi([
  "function authorize(address agent, address token, uint128 dailyCap, address recipient)",
  "function revoke()",
  "function pull(address user, uint256 amount)",
  "function authorizations(address) view returns (address agent, address token, address recipient, uint128 dailyCap, uint128 spentToday, uint64 day, bool active)",
]);

const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`missing ${k}`);
  return v;
};

const rpc = env("RPC_URL");
const transport = http(rpc);
const publicClient = createPublicClient({ transport });
const chain = defineChain({
  id: 4801,
  name: "worldchain-sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpc] } },
});
const leash = env("LEASH") as `0x${string}`;

async function main() {
  const [mode, amount] = process.argv.slice(2);
  const user = privateKeyToAccount(env("USER_KEY") as `0x${string}`);
  const agent = privateKeyToAccount(env("AGENT_KEY") as `0x${string}`);

  if (mode === "authorize") {
    const wallet = createWalletClient({ account: user, chain, transport });
    const tx = await wallet.writeContract({
      address: leash, abi, functionName: "authorize",
      args: [agent.address, env("TOKEN") as `0x${string}`, BigInt(amount ?? "2000000000000000000"), env("RECIPIENT") as `0x${string}`],
    });
    console.log("authorize tx:", tx, (await publicClient.waitForTransactionReceipt({ hash: tx })).status);
  } else if (mode === "pull") {
    const wallet = createWalletClient({ account: agent, chain, transport });
    const tx = await wallet.writeContract({
      address: leash, abi, functionName: "pull", args: [user.address, BigInt(amount ?? "2000000000000000000")],
    });
    console.log("pull tx:", tx, (await publicClient.waitForTransactionReceipt({ hash: tx })).status);
  } else if (mode === "status") {
    const a = await publicClient.readContract({ address: leash, abi, functionName: "authorizations", args: [user.address] });
    console.log(`agent=${a[0]} cap=${a[3]} spentToday=${a[4]} active=${a[6]}`);
  } else {
    throw new Error("mode: authorize|pull|status");
  }
}
main().catch((e) => { console.error(e.shortMessage ?? e.message); process.exit(1); });
