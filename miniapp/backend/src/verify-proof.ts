import { config } from "./config";

export type PortalVerifyResult = {
  ok: boolean;
  nullifier?: string;
  identityAttested?: boolean;
  detail?: string;
  raw: unknown;
};

/// Forwards the IDKit result payload as-is to the Developer Portal
/// (POST /api/v4/verify/{rp_id}, per api-reference/verify.md — "no field remapping required")
/// and extracts nullifier + identity_attested from the response.
export async function verifyWithPortal(idkitResponse: unknown): Promise<PortalVerifyResult> {
  const response = await fetch(`${config.worldApiBase()}/api/v4/verify/${config.rpId()}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(idkitResponse),
  });

  const body = (await response.json()) as {
    success?: boolean;
    nullifier?: string;
    detail?: string;
    identity_attested?: boolean;
    results?: Array<{
      identifier?: string;
      success?: boolean;
      nullifier?: string;
      identity_attested?: boolean;
      detail?: string;
    }>;
  };

  if (!response.ok || body.success !== true) {
    return { ok: false, detail: body.detail ?? `HTTP ${response.status}`, raw: body };
  }

  const firstSuccess = body.results?.find((r) => r.success);
  // Docs (configure-credentail.md L207) say successful Identity Check responses include
  // `identity_attested` but not WHERE — accept it at top level or per-result. Beta feedback item.
  const identityAttested = body.identity_attested ?? firstSuccess?.identity_attested;

  return {
    ok: true,
    nullifier: body.nullifier ?? firstSuccess?.nullifier,
    identityAttested,
    raw: body,
  };
}
