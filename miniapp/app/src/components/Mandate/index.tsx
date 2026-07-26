'use client';

import {
  DEMO_AGENT_HUMAN_ID,
  DEMO_INITIAL_CAP,
  DEMO_RECIPIENT,
  DEMO_TOKEN_ADDRESS,
  DEMO_TOKEN_SYMBOL,
  MANDATE_ADDRESS,
  MANDATE_CHAIN_ID,
  WORLDCHAIN_RPC,
  DEFAULT_MANDATE_ID,
  explorerAddress,
  mandateAbi,
  type MandateView,
} from '@/lib/mandate';
import { ActivityFeed } from '@/components/Activity';
import { Handoff } from '@/components/Handoff';
import { RoutePanel } from '@/components/Route';
import { useWalletAddress } from '@/hooks/useWalletAddress';
import { WINDOW_SECONDS } from '@/components/Spending/format';
import { IDKit, selfieCheckLegacy, type RpContext } from '@worldcoin/idkit';
import {
  Button,
  Chip,
  Input,
  Marble,
  Progress,
} from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit } from '@worldcoin/minikit-js';
import { useWaitForUserOperationReceipt } from '@worldcoin/minikit-react';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPublicClient, encodeFunctionData, http, isAddress } from 'viem';
import { worldchain } from 'viem/chains';
import styles from './Mandate.module.css';

function short(addr: string): string {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Person IDs are 70+ digit numbers — head/tail so a user can compare two by eye. */
function shortId(id: string): string {
  if (!id || id.length <= 20) return id;
  return `${id.slice(0, 10)}…${id.slice(-8)}`;
}

const MAX_HUMAN_ID = BigInt(2) ** BigInt(256);

/**
 * The cap `authorize` actually writes on-chain, as a whole number. It seeds the
 * "New daily limit" field so the field opens on the card's real value instead of a
 * number invented for a story.
 */
const STARTING_CAP = (DEMO_INITIAL_CAP / BigInt(10) ** BigInt(18)).toString();

function formatUnitsLoose(raw: string, decimals = 18): string {
  try {
    const v = BigInt(raw);
    const base = BigInt(10) ** BigInt(decimals);
    const whole = v / base;
    const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac.slice(0, 6)}` : whole.toString();
  } catch {
    return raw;
  }
}

function capUsagePercent(spent: string, cap: string): number {
  try {
    const s = BigInt(spent);
    const c = BigInt(cap);
    if (c <= BigInt(0)) return 0;
    const pct = Number((s * BigInt(1000)) / c) / 10;
    return Math.max(0, Math.min(100, pct));
  } catch {
    return 0;
  }
}

function errorText(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'string' && e.length > 0) return e;
  try {
    return JSON.stringify(e);
  } catch {
    return 'Unknown error';
  }
}

type MandatePanelProps = {
  serverWallet?: string;
};

export function MandatePanel({ serverWallet }: MandatePanelProps) {
  const session = useSession();
  const wallet = useWalletAddress() ?? serverWallet;
  const [mandate, setMandate] = useState<MandateView | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [busy, setBusy] = useState<'authorize' | 'revoke' | 'stepup' | undefined>();
  const [feedback, setFeedback] = useState<'pending' | 'success' | 'failed' | undefined>();
  const [errorMsg, setErrorMsg] = useState<string | undefined>();
  const [userOpHash, setUserOpHash] = useState('');
  const [newCap, setNewCap] = useState(STARTING_CAP);
  const [newRecipient, setNewRecipient] = useState('');
  const [agentOwner, setAgentOwner] = useState<'mine' | 'operator'>('mine');
  const [ownHumanId, setOwnHumanId] = useState('');
  const [operatorAck, setOperatorAck] = useState(false);
  /** Bumped after every confirmed write so the on-chain feed re-reads. */
  const [chainVersion, setChainVersion] = useState(0);

  /** Whose assistant the user is about to let spend. null = nothing valid entered yet. */
  const ownHumanIdValue = useMemo(() => {
    const raw = ownHumanId.trim();
    if (!/^\d+$/.test(raw)) return null;
    const value = BigInt(raw);
    if (value <= BigInt(0) || value >= MAX_HUMAN_ID) return null;
    return value;
  }, [ownHumanId]);

  const authorizedHumanId = agentOwner === 'operator' ? DEMO_AGENT_HUMAN_ID : ownHumanIdValue;
  const canAuthorize =
    Boolean(wallet) && authorizedHumanId !== null && (agentOwner !== 'operator' || operatorAck);

  const client = useMemo(
    () =>
      createPublicClient({
        chain: worldchain,
        transport: http(
          process.env.NEXT_PUBLIC_WORLDCHAIN_RPC ??
            'https://worldchain-mainnet.g.alchemy.com/public',
        ),
      }),
    [],
  );

  const { isLoading, isSuccess, isError, error: receiptError } = useWaitForUserOperationReceipt({
    client,
    userOpHash,
  });

  const refresh = useCallback(async () => {
    if (!wallet) return;
    setLoadError(undefined);
    try {
      const res = await fetch(`/api/mandate/${wallet}`);
      const data = (await res.json()) as {
        mandate?: MandateView;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.mandate) {
        setLoadError(data.detail ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      setMandate(data.mandate);
      if (
        data.mandate.recipient &&
        data.mandate.recipient !== '0x0000000000000000000000000000000000000000'
      ) {
        setNewRecipient((prev) => prev || data.mandate!.recipient);
      }
    } catch (e) {
      setLoadError(errorText(e));
    }
  }, [wallet]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (isSuccess) {
      setFeedback('success');
      setUserOpHash('');
      setBusy(undefined);
      setChainVersion((v) => v + 1);
      void refresh();
      setTimeout(() => setFeedback(undefined), 3000);
    }
    if (isError) {
      setFeedback('failed');
      setErrorMsg(
        receiptError instanceof Error
          ? receiptError.message
          : errorText(receiptError) ||
              'Request failed or timed out — check Dev Portal contract whitelist',
      );
      setUserOpHash('');
      setBusy(undefined);
      setTimeout(() => setFeedback(undefined), 4000);
    }
  }, [isSuccess, isError, refresh, receiptError]);

  const sendCall = async (data: `0x${string}`) => {
    const result = await MiniKit.sendTransaction({
      chainId: MANDATE_CHAIN_ID,
      transactions: [{ to: MANDATE_ADDRESS, data }],
    });
    if (!result.data?.userOpHash) throw new Error('No userOpHash returned');
    setUserOpHash(result.data.userOpHash);
  };

  /**
   * Grants a standing pull on THIS wallet to every agent registered by one person.
   * The humanId is never implicit: it is either one the user pasted, or this app's own
   * operator behind an explicit, ticked opt-in.
   */
  const onAuthorize = async () => {
    setBusy('authorize');
    setFeedback('pending');
    setErrorMsg(undefined);
    try {
      if (!wallet) throw new Error('No wallet address — open in World App and sign in');
      if (authorizedHumanId === null) {
        throw new Error('Paste the Person ID of the assistant you want to allow');
      }
      if (agentOwner === 'operator' && !operatorAck) {
        throw new Error('Tick the box to confirm whose assistant you are allowing');
      }
      // The contract stores a chain- and contract-scoped reference, never the raw
      // nullifier, so the id is hashed on-chain before it is ever written down.
      const client = createPublicClient({
        chain: worldchain,
        transport: http(WORLDCHAIN_RPC),
      });
      const authorizedHumanRef = await client.readContract({
        address: MANDATE_ADDRESS,
        abi: mandateAbi,
        functionName: 'humanRef',
        args: [authorizedHumanId],
      });
      await sendCall(
        encodeFunctionData({
          abi: mandateAbi,
          functionName: 'authorize',
          args: [
            DEFAULT_MANDATE_ID,
            authorizedHumanRef,
            DEMO_TOKEN_ADDRESS,
            DEMO_INITIAL_CAP,
            DEMO_INITIAL_CAP,
            DEMO_RECIPIENT,
          ],
        }),
      );
    } catch (e) {
      setErrorMsg(errorText(e));
      setFeedback('failed');
      setBusy(undefined);
      setTimeout(() => setFeedback(undefined), 3000);
    }
  };

  const onRevoke = async () => {
    setBusy('revoke');
    setFeedback('pending');
    setErrorMsg(undefined);
    try {
      await sendCall(
        encodeFunctionData({
          abi: mandateAbi,
          functionName: 'revoke',
          args: [DEFAULT_MANDATE_ID],
        }),
      );
    } catch (e) {
      setErrorMsg(errorText(e));
      setFeedback('failed');
      setBusy(undefined);
      setTimeout(() => setFeedback(undefined), 3000);
    }
  };

  const onStepUp = async () => {
    setBusy('stepup');
    setFeedback('pending');
    setErrorMsg(undefined);
    try {
      if (!wallet) throw new Error('No wallet address');
      if (!isAddress(newRecipient)) throw new Error('Payee must be a valid address');
      const capRaw = BigInt(newCap) * BigInt(10) ** BigInt(18);

      const action = process.env.NEXT_PUBLIC_STEPUP_ACTION ?? 'mandate-step-up';
      const rpRes = await fetch('/api/rp-signature', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!rpRes.ok) {
        const body = (await rpRes.json().catch(() => null)) as
          | { error?: string; detail?: string }
          | null;
        throw new Error(
          body?.detail ??
            body?.error ??
            `Failed to get RP signature for Selfie step-up (HTTP ${rpRes.status})`,
        );
      }
      const rpSig = (await rpRes.json()) as {
        rp_id: string;
        nonce: string;
        created_at: number;
        expires_at: number;
        sig: string;
      };
      const rpContext: RpContext = {
        rp_id: rpSig.rp_id,
        nonce: rpSig.nonce,
        created_at: rpSig.created_at,
        expires_at: rpSig.expires_at,
        signature: rpSig.sig,
      };

      // Selfie = person-bound reauthentication / step-up — NOT issuing Proof of Human.
      const request = await IDKit.request({
        app_id: process.env.NEXT_PUBLIC_APP_ID as `app_${string}`,
        action,
        rp_context: rpContext,
        allow_legacy_proofs: true,
      }).preset(selfieCheckLegacy({ signal: wallet }));

      const completion = await request.pollUntilCompletion();
      if (!completion.success) {
        throw new Error(`Selfie Check failed: ${JSON.stringify(completion).slice(0, 280)}`);
      }

      const stepRes = await fetch('/api/step-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: wallet,
          mandateId: DEFAULT_MANDATE_ID,
          newCap: capRaw.toString(),
          newRecipient,
          idkitResponse: completion.result,
        }),
      });
      const step = (await stepRes.json()) as {
        signature?: `0x${string}`;
        deadline?: string;
        error?: string;
        detail?: string;
      };
      if (!stepRes.ok || !step.signature || !step.deadline) {
        throw new Error(step.detail ?? step.error ?? 'step-up signing failed');
      }

      await sendCall(
        encodeFunctionData({
          abi: mandateAbi,
          functionName: 'raiseLimits',
          args: [
            DEFAULT_MANDATE_ID,
            capRaw,
            newRecipient as `0x${string}`,
            BigInt(step.deadline),
            step.signature,
          ],
        }),
      );
    } catch (e) {
      setErrorMsg(errorText(e));
      setFeedback('failed');
      setBusy(undefined);
      setTimeout(() => setFeedback(undefined), 4000);
    }
  };

  const username = session.data?.user?.username;
  const avatar = session.data?.user?.profilePictureUrl;
  const hasMandate = Boolean(mandate && !mandate.empty);
  /**
   * The contract clears spentInWindow lazily, on the next pull — so once the window has
   * elapsed the stored figure no longer applies and the allowance is whole again. Reading
   * it without checking windowStart made this panel claim the cap was used up while the
   * Spending tab, which does check, said the opposite about the same card.
   */
  const windowStart = Number(mandate?.windowStart ?? 0);
  const windowElapsed = windowStart === 0 || Date.now() / 1000 - windowStart >= WINDOW_SECONDS;
  const spentNow = hasMandate && !windowElapsed ? mandate!.spentInWindow : '0';
  const usage = hasMandate ? capUsagePercent(spentNow, mandate!.windowCap) : 0;

  /* The chip carries the state. It used to be followed by a sentence restating it. */
  let statusLabel = 'Not set up';
  let chipVariant: 'default' | 'success' | 'error' = 'default';
  if (hasMandate && mandate?.active) {
    statusLabel = 'On';
    chipVariant = 'success';
  } else if (hasMandate && mandate && !mandate.active) {
    statusLabel = 'Stopped';
    chipVariant = 'error';
  }

  return (
    <div className={styles.shell}>
      <header className={styles.brandBlock}>
        <div className={styles.logoRow}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo/world-logo-off-black.svg"
            alt=""
            width={28}
            height={28}
            className={styles.logo}
          />
          <p className={styles.brandName}>HumanMandate</p>
        </div>
        {/* Claiming "Signed in" with no wallet resolved is a lie the user can see through
            the moment every button stays disabled. Say which state we are actually in. */}
        <div className={styles.identityRow}>
          <div className={styles.identityMeta}>
            <div className={styles.identityLabel}>
              {wallet ? 'Signed in' : 'Not connected'}
            </div>
            <div className={styles.identityName}>
              {wallet ? (username ?? 'World App user') : 'Open in World App to sign in'}
            </div>
          </div>
          <Marble src={avatar} className="w-11" />
        </div>
      </header>

      <section className={styles.statusPanel} aria-live="polite">
        <div className={styles.statusHeader}>
          <h2 className={styles.statusTitle}>Your card</h2>
          <div className={styles.badgeWrap}>
            <Chip
              variant={chipVariant}
              label={statusLabel}
              icon={
                hasMandate && mandate?.active ? (
                  <span className={styles.liveDot} aria-hidden />
                ) : undefined
              }
            />
          </div>
        </div>
        {/* Notifications only: the two states the user cannot act their way out of. */}
        {!wallet && <p className={styles.warnNote}>Open in World App</p>}
        {loadError && <p className={styles.errorBox}>{loadError}</p>}

        {hasMandate && mandate && (
          <>
            <dl className={styles.metrics}>
              <div>
                <dt className={styles.metricLabel}>Daily limit</dt>
                <dd className={styles.metricValue}>{formatUnitsLoose(mandate.windowCap)}</dd>
              </div>
              <div>
                <dt className={styles.metricLabel}>Used today</dt>
                <dd className={styles.metricValue}>{formatUnitsLoose(spentNow)}</dd>
              </div>
              <div className={styles.metricWide}>
                <dt className={styles.metricLabel}>Pays only to</dt>
                <dd className={styles.metricValue}>{short(mandate.recipient)}</dd>
              </div>
            </dl>
            {/* The bar is the read-out; the figures above it are the same two numbers. */}
            <div className={styles.capBar}>
              <Progress value={usage} className="w-full" />
            </div>
          </>
        )}

        <button type="button" className={styles.refreshBtn} onClick={() => void refresh()}>
          Refresh
        </button>
      </section>

      <Handoff wallet={wallet} mandate={mandate} />

      <RoutePanel wallet={wallet} refreshKey={chainVersion} />

      <ActivityFeed wallet={wallet} refreshKey={chainVersion} />

      <section className={styles.actions}>
        {feedback && (
          <p
            className={`${styles.feedback} ${
              feedback === 'failed'
                ? styles.feedbackFailed
                : feedback === 'success'
                  ? styles.feedbackSuccess
                  : styles.feedbackPending
            }`}
            role="status"
          >
            {feedback === 'failed' && 'Failed — see details below'}
            {feedback === 'success' && 'Submitted'}
            {feedback === 'pending' &&
              (isLoading || busy === 'authorize' || busy === 'revoke' || busy === 'stepup'
                ? 'Confirm in World…'
                : 'Working…')}
          </p>
        )}

        {(!hasMandate || (mandate && !mandate.active)) && (
          <div className={styles.setup}>
            <h3 className={styles.setupTitle}>Turn on the card</h3>

            <div className={styles.modeRow} role="group" aria-label="Whose assistant">
              <button
                type="button"
                className={`${styles.modeBtn} ${agentOwner === 'mine' ? styles.modeBtnActive : ''}`}
                aria-pressed={agentOwner === 'mine'}
                onClick={() => setAgentOwner('mine')}
              >
                My assistant
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${agentOwner === 'operator' ? styles.modeBtnActive : ''}`}
                aria-pressed={agentOwner === 'operator'}
                onClick={() => setAgentOwner('operator')}
              >
                This app&rsquo;s assistant
              </button>
            </div>

            {agentOwner === 'mine' ? (
              <div className={styles.fieldStack}>
                <Input
                  label="Person ID of the assistant's owner"
                  value={ownHumanId}
                  onChange={(e) => setOwnHumanId(e.target.value.replace(/[^\d]/g, ''))}
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                />
                {ownHumanId.length > 0 && ownHumanIdValue === null && (
                  <p className={styles.fieldError}>Digits only</p>
                )}
              </div>
            ) : (
              /*
               * The only sentence left in the setup flow, and it stays: the user is
               * handing a third party a standing pull on their own wallet. A control
               * that does that without saying so is not a leaner UI, it is a trap.
               */
              <div className={styles.demoWarn}>
                <span className={styles.idValue}>{DEMO_AGENT_HUMAN_ID.toString()}</span>
                <label className={styles.ackRow}>
                  <input
                    type="checkbox"
                    className={styles.ackBox}
                    checked={operatorAck}
                    onChange={(e) => setOperatorAck(e.target.checked)}
                  />
                  <span>Let this person&rsquo;s assistant spend from my wallet. I can stop it anytime.</span>
                </label>
              </div>
            )}

            {/* The three terms `authorize` writes on-chain. Values, not sentences. */}
            <dl className={styles.disclosureList}>
              <div className={styles.disclosureRow}>
                <dt className={styles.disclosureLabel}>Who</dt>
                <dd className={styles.disclosureValue}>
                  {authorizedHumanId !== null ? shortId(authorizedHumanId.toString()) : '—'}
                </dd>
              </div>
              <div className={styles.disclosureRow}>
                <dt className={styles.disclosureLabel}>Cap</dt>
                <dd className={styles.disclosureValue}>
                  {STARTING_CAP} {DEMO_TOKEN_SYMBOL} / day
                </dd>
              </div>
              <div className={styles.disclosureRow}>
                <dt className={styles.disclosureLabel}>Payee</dt>
                <dd className={styles.disclosureValue}>
                  <a
                    className={styles.beatLink}
                    href={explorerAddress(DEMO_RECIPIENT)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {short(DEMO_RECIPIENT)}
                  </a>
                </dd>
              </div>
            </dl>

            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => void onAuthorize()}
              disabled={!!busy || !canAuthorize}
            >
              Turn on card
            </Button>
          </div>
        )}

        <div className={styles.stepUp}>
          <div className={styles.fieldStack}>
            <Input
              label="New daily limit"
              value={newCap}
              onChange={(e) => setNewCap(e.target.value.replace(/[^\d]/g, ''))}
              inputMode="numeric"
              autoComplete="off"
            />
            <Input
              label="New payee"
              value={newRecipient}
              onChange={(e) => setNewRecipient(e.target.value.trim())}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => void onStepUp()}
            disabled={!!busy || !mandate?.active}
          >
            Raise with face
          </Button>
        </div>

        <Button
          type="button"
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => void onRevoke()}
          disabled={!!busy || !mandate?.active}
        >
          Stop spending
        </Button>

        {errorMsg && <p className={styles.errorBox}>{errorMsg}</p>}
      </section>

      {/*
        The "Proof details" block that used to close this screen — the judge-facing
        essay, the eleven demo hashes, the two contract rows — has moved out. It is
        argument about the product, and it already lives on /desk, where the argument
        belongs. What is left here is the card itself.
      */}
    </div>
  );
}
