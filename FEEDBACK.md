# Uniswap Trading API — Developer Feedback

## What we built

`scripts/swap.ts` is a minimal CLI against the Uniswap Trading API
(`https://trade-api.gateway.uniswap.org/v1`): `quote` mode fetches a price with
no risk, `swap` mode runs the real `check_approval → quote → swap → broadcast`
flow and sends the resulting transaction with viem. It is gated behind
`TRADE_CONFIRM=yes` so no trade fires without an explicit human decision on
that exact quote — we wanted a real swap path, not a demo stub.

## What worked well

Three endpoints cover the whole flow, the JSON is plain to parse, and the
quote response spreads almost directly into the `/swap` request body — no SDK
needed, a REST client was enough. Any EVM chain is just a `chainId` argument.

## Friction points

**Two incompatible response shapes behind one `routing` field.** `getQuoteSummary`
branches on whether `routing` is `DUTCH_V2/DUTCH_V3/PRIORITY` (UniswapX) or
not: UniswapX quotes carry `quote.orderInfo.outputs[0].{startAmount,endAmount}`,
Classic quotes carry `quote.output.amount`. There is no common field for "the
output amount," so every caller reimplements this branch.

**`/swap` accepts different payloads per routing type.** Our comment on
`prepareSwapRequest` says it plainly: "UniswapX must NOT receive permitData;
CLASSIC needs both or neither." We strip `permitData`/`permitTransaction` out
of every quote and only re-attach them, with the signature, for Classic —
that rule isn't discoverable from the response itself.

**Approval is a full second transaction, not a signature.** Our swap leg
comment notes we run "CLASSIC without Permit2 signature — backend
legacy-approval pattern": `/check_approval` can return an on-chain approval
tx that must be sent and confirmed before `/swap` is even called, so a
first-time swap is two confirmed transactions, not one.

**Expired quotes come back looking like success.** We had to add
`if (!swap?.data || swap.data === "0x" || !isHex(swap.data)) throw new Error("swap.data empty/invalid — quote expired, re-run")`
because a stale quote doesn't produce an HTTP error — `/swap` returns 200 with
unusable calldata, and the caller has to notice.

**Error shape isn't guaranteed.** Our `api()` wrapper falls back to
`JSON.stringify(data).slice(0, 300)` when `data.detail` is missing, because
not every failure includes a `detail` field.

## Suggestions

- Normalize `/quote` so output amount and gas fee live at one stable path
  regardless of routing.
- Document (or better, have the API enforce/ignore) which `/swap` fields are
  valid per routing type, instead of requiring callers to strip fields
  themselves.
- Return a distinct expired-quote error instead of a 200 with empty calldata.
- Guarantee `detail` (or an equivalent) on every error response.
