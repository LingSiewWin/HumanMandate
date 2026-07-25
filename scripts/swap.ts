/**
 * First Stock — Uniswap Trading API swap script (M3 lego).
 * Flow per official skill: /check_approval → /quote → /swap → broadcast.
 *
 * Usage:
 *   bun run swap.ts quote  <chainId> <tokenIn> <tokenOut> <amountBaseUnits>   # free, no tx
 *   bun run swap.ts swap   <chainId> <tokenIn> <tokenOut> <amountBaseUnits>   # REAL trade — asks for TRADE_CONFIRM=yes
 *
 * Env: UNISWAP_API_KEY (developers.uniswap.org), PRIVATE_KEY (trade wallet), RPC_URL (chain RPC)
 */
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  isAddress,
  isHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const API_URL = "https://trade-api.gateway.uniswap.org/v1";

const headers = () => ({
  "Content-Type": "application/json",
  "x-api-key": required("UNISWAP_API_KEY"),
  "x-universal-router-version": "2.0",
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name}`);
  return value;
}

function validateAddress(value: string, label: string): `0x${string}` {
  if (!/^0x[a-fA-F0-9]{40}$/.test(value)) throw new Error(`invalid ${label}: ${value}`);
  return value as `0x${string}`;
}

async function api(path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(`${path} ${response.status}: ${data.detail ?? JSON.stringify(data).slice(0, 300)}`);
  }
  return data;
}

function getQuoteSummary(quoteResponse: Record<string, unknown>) {
  const routing = quoteResponse.routing as string;
  const quote = quoteResponse.quote as Record<string, unknown>;
  const isUniswapX = ["DUTCH_V2", "DUTCH_V3", "PRIORITY"].includes(routing);
  if (isUniswapX) {
    const orderInfo = quote.orderInfo as { outputs: Array<{ startAmount: string; endAmount: string }> };
    const out = orderInfo.outputs[0];
    if (!out) throw new Error("UniswapX quote has no outputs");
    return { routing, outputAmount: out.startAmount, floorAmount: out.endAmount, gasFeeUSD: "0 (gasless)" };
  }
  const output = quote.output as { amount: string };
  return { routing, outputAmount: output.amount, floorAmount: output.amount, gasFeeUSD: String(quote.gasFeeUSD) };
}

/** Routing-aware /swap body per skill: UniswapX must NOT receive permitData; CLASSIC needs both or neither. */
function prepareSwapRequest(quoteResponse: Record<string, unknown>, signature?: string): object {
  const { permitData, permitTransaction: _pt, ...cleanQuote } = quoteResponse;
  const request: Record<string, unknown> = { ...cleanQuote };
  const isUniswapX = ["DUTCH_V2", "DUTCH_V3", "PRIORITY"].includes(quoteResponse.routing as string);
  if (isUniswapX) {
    if (signature) request.signature = signature;
  } else if (signature && permitData && typeof permitData === "object") {
    request.signature = signature;
    request.permitData = permitData;
  }
  return request;
}

async function main() {
  const [mode, chainIdArg, tokenInArg, tokenOutArg, amount] = process.argv.slice(2);
  if (!mode || !chainIdArg || !tokenInArg || !tokenOutArg || !amount) {
    console.error("usage: bun run swap.ts <quote|swap> <chainId> <tokenIn> <tokenOut> <amountBaseUnits>");
    process.exit(1);
  }
  if (!/^[0-9]+$/.test(amount)) throw new Error("amount must be integer base units");
  const chainId = Number(chainIdArg);
  const tokenIn = validateAddress(tokenInArg, "tokenIn");
  const tokenOut = validateAddress(tokenOutArg, "tokenOut");

  const account = privateKeyToAccount(required("PRIVATE_KEY") as `0x${string}`);
  console.log(`swapper: ${account.address} | chain ${chainId} | ${amount} of ${tokenIn} -> ${tokenOut}`);

  const quoteResponse = await api("/quote", {
    swapper: account.address,
    tokenIn,
    tokenOut,
    tokenInChainId: String(chainId),
    tokenOutChainId: String(chainId),
    amount,
    type: "EXACT_INPUT",
    slippageTolerance: 0.5,
    routingPreference: "BEST_PRICE",
  });
  console.log("quote:", JSON.stringify(getQuoteSummary(quoteResponse)));

  if (mode === "quote") return;

  if (process.env.TRADE_CONFIRM !== "yes") {
    throw new Error("REAL trade blocked: set TRADE_CONFIRM=yes after the user explicitly approves this exact trade");
  }

  const transport = http(required("RPC_URL"));
  const publicClient = createPublicClient({ transport });
  const chain = defineChain({
    id: chainId,
    name: `chain-${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [required("RPC_URL")] } },
  });
  const walletClient = createWalletClient({ account, chain, transport });

  // 1. approval leg
  const approvalData = await api("/check_approval", {
    walletAddress: account.address,
    token: tokenIn,
    amount,
    chainId,
  });
  const approval = approvalData.approval as { to: `0x${string}`; data: `0x${string}`; value?: string } | null;
  if (approval) {
    const hash = await walletClient.sendTransaction({
      to: approval.to,
      data: approval.data,
      value: BigInt(approval.value ?? "0"),
    });
    await publicClient.waitForTransactionReceipt({ hash });
    console.log("approval tx:", hash);
  }

  // 2. swap leg (CLASSIC without Permit2 signature — backend legacy-approval pattern)
  const swapData = await api("/swap", prepareSwapRequest(quoteResponse));
  const swap = swapData.swap as { to: string; from: string; data: string; value?: string };
  if (!swap?.data || swap.data === "0x" || !isHex(swap.data)) throw new Error("swap.data empty/invalid — quote expired, re-run");
  if (!isAddress(swap.to) || !isAddress(swap.from)) throw new Error("invalid address in swap response");

  const hash = await walletClient.sendTransaction({
    to: swap.to as `0x${string}`,
    data: swap.data as `0x${string}`,
    value: BigInt(swap.value ?? "0"),
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log(`swap tx: ${hash} | status: ${receipt.status}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
