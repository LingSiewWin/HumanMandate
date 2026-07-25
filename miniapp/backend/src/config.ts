const required = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var ${name} — see .env.example`);
  return value;
};

export const config = {
  // World Developer Portal (https://developer.world.org)
  rpId: () => required("WORLD_RP_ID"),
  rpSigningKey: () => required("WORLD_RP_SIGNING_KEY"),
  action: () => process.env.WORLD_ACTION ?? "first-stock-eligibility",
  worldApiBase: () => process.env.WORLD_API_BASE ?? "https://developer.world.org",

  // Chain registration
  checkerAddress: () => required("CHECKER_ADDRESS") as `0x${string}`,
  backendSignerKey: () => required("BACKEND_SIGNER_KEY") as `0x${string}`,
  chainRpcUrl: () => required("CHAIN_RPC_URL"),

  port: () => Number(process.env.PORT ?? 3001),
};
