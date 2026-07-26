/**
 * Named buyers for the mandate, shared by the mini-app scenario strip and /desk.
 *
 * These are design targets, not customers — we have none. Copy stays free of chain
 * vocabulary; `proofTx` is the mainnet transaction where the chain actually performs
 * the refusal each scenario is asking for (hashes mirror lib/mandate.ts).
 */

export type ScenarioId = 'overnight' | 'metered' | 'contractor';

export type Scenario = {
  id: ScenarioId;
  /** Chip label — short enough for a phone row. */
  tab: string;
  person: string;
  who: string;
  pain: string;
  /** How the card is set for this person. */
  setup: string;
  /** Product Maya/Rui/Ana already use, so nobody has to learn a new category. */
  familiar: string;
  /** Prefills the New daily limit field — this is a real input to raiseLimits. */
  dailyLimit: string;
  proofLabel: string;
  proofTx: `0x${string}`;
};

export const scenarios: readonly Scenario[] = [
  {
    id: 'overnight',
    tab: 'Overnight agent',
    person: 'Maya',
    who: 'Solo founder. Her coding assistant keeps working after she goes to bed.',
    pain: 'One bad retry loop can spend all night before anyone is awake to notice.',
    setup: 'Small daily limit, one payee. Worst case is capped at a single day.',
    familiar: 'Like a Revolut company card with a daily cap.',
    dailyLimit: '20',
    proofLabel: 'Past the daily limit, the chain refuses — CapExceeded',
    proofTx: '0xe91dcc5f00fafbed9154e6952689f6a155604511992187608b95c1aa4d54f2be',
  },
  {
    id: 'metered',
    tab: 'Pay-per-call supplier',
    person: 'Rui',
    who: 'Runs an assistant that buys data one call at a time from one supplier.',
    pain: 'A wrong endpoint in the config sends the money somewhere he never approved.',
    setup: 'The payee is locked. Moving it takes his face, not just his unlocked phone.',
    familiar: 'Like a Privacy.com card locked to a single merchant.',
    dailyLimit: '5',
    proofLabel: 'Changing limit or payee without a face check — LivenessRequired',
    proofTx: '0x61f5ccf45deaa8f40712b769fd44f50b8a614dc38f05b51253dc00045911cdd5',
  },
  {
    id: 'contractor',
    tab: 'Contractor’s bot',
    person: 'Ana',
    who: 'Lets a contractor’s assistant draw its own fee instead of invoicing her.',
    pain: 'When the work ends, cutting off one address does nothing — they open another.',
    setup: 'One tap stops the person. New addresses from that person are refused too.',
    familiar: 'Like finance freezing every card issued to one employee.',
    dailyLimit: '100',
    proofLabel: 'Stopped, then a brand-new address from the same person — NotAuthorized',
    proofTx: '0x23db1c10f5108d9d9ef930da742dd9fee9246d4293591ebe15775d51db115dab',
  },
] as const;

export const defaultScenario = scenarios[0];

export function getScenario(id: ScenarioId): Scenario {
  return scenarios.find((s) => s.id === id) ?? defaultScenario;
}
