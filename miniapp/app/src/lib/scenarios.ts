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
    proofTx: '0x0c77801c7b368363323790bd7b1c6d2d2c53592ad6e008c9df754f9d53dacf2b',
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
    proofTx: '0xa0f862aa698ddc389499beaa58aef53df1543eb2032da219d6f95569634ec924',
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
    proofTx: '0x73db31754625ace1dc5ef9b98eb1188c609831afd291be6197de601f22b22208',
  },
] as const;

export const defaultScenario = scenarios[0];

export function getScenario(id: ScenarioId): Scenario {
  return scenarios.find((s) => s.id === id) ?? defaultScenario;
}
