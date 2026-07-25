import { config } from "./config";
import { createRpSignature } from "./rp-signature";
import { verifyWithPortal } from "./verify-proof";
import { isNullifierUsed, markNullifierUsed } from "./nullifier-store";
import { registerOnchain, isVerifiedOnchain } from "./register-onchain";

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });

const server = Bun.serve({
  port: config.port(),
  routes: {
    "/api/health": () => json({ ok: true }),

    // Step 3 of the World integration guide: RP signature, server-side only
    "/api/rp-signature": {
      POST: async (req) => {
        const { action } = (await req.json().catch(() => ({}))) as { action?: string };
        return json(createRpSignature(action ?? config.action()));
      },
    },

    // Steps 5-6 + our chain registration: verify proof → nullifier replay check → allowlist on-chain
    "/api/verify-proof": {
      POST: async (req) => {
        const body = (await req.json().catch(() => null)) as {
          wallet?: `0x${string}`;
          idkitResponse?: unknown;
        } | null;
        if (!body?.wallet || !body.idkitResponse) {
          return json({ error: "wallet and idkitResponse required" }, 400);
        }

        const result = await verifyWithPortal(body.idkitResponse);
        if (!result.ok) return json({ error: "verification_failed", detail: result.detail }, 400);
        if (result.identityAttested === false) {
          return json({ error: "attributes_not_attested" }, 403);
        }
        if (!result.nullifier) return json({ error: "no_nullifier_in_response" }, 502);

        if (await isNullifierUsed(result.nullifier)) {
          return json({ error: "nullifier_already_used" }, 409);
        }

        const { txHash } = await registerOnchain(body.wallet, result.nullifier);
        await markNullifierUsed(result.nullifier, body.wallet);
        return json({ success: true, txHash });
      },
    },

    "/api/status/:wallet": async (req) => {
      const wallet = req.params.wallet as `0x${string}`;
      return json({ wallet, verified: await isVerifiedOnchain(wallet) });
    },
  },
});

console.log(`first-stock backend listening on :${server.port}`);
