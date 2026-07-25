import { signRequest } from "@worldcoin/idkit-core/signing";
import { config } from "./config";

export type RpSignatureResponse = {
  sig: string;
  nonce: string;
  created_at: number;
  expires_at: number;
};

/// Signs a proof request with the RP signing key (server-side only, per World docs:
/// world-id/rp-signature.md — never expose the key to the client).
export function createRpSignature(action: string): RpSignatureResponse {
  const { sig, nonce, createdAt, expiresAt } = signRequest({
    signingKeyHex: config.rpSigningKey(),
    action,
    ttl: 300,
  });
  return { sig, nonce, created_at: createdAt, expires_at: expiresAt };
}
