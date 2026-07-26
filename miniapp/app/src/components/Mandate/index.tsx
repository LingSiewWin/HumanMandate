'use client';

import {
  DEMO_HUMAN_ID,
  DEMO_INITIAL_CAP,
  DEMO_RECIPIENT,
  DEMO_TOKEN_ADDRESS,
  MANDATE_ADDRESS,
  MANDATE_CHAIN_ID,
  OLD_MANDATE_ADDRESS,
  REGISTRY_ADDRESS,
  explorerAddress,
  explorerTx,
  mandateAbi,
  newFiveBeat,
  newStepUp,
  oldFiveBeat,
  type MandateView,
} from '@/lib/mandate';
import { ScenarioStrip } from '@/components/Scenarios';
import { defaultScenario, getScenario, type ScenarioId } from '@/lib/scenarios';
import { useWalletAddress } from '@/hooks/useWalletAddress';
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
  const [lastUserOpHash, setLastUserOpHash] = useState('');
  const [newCap, setNewCap] = useState(defaultScenario.dailyLimit);
  const [newRecipient, setNewRecipient] = useState('');
  const [scenarioId, setScenarioId] = useState<ScenarioId>(defaultScenario.id);

  const onPickScenario = (id: ScenarioId) => {
    setScenarioId(id);
    setNewCap(getScenario(id).dailyLimit);
  };

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
    setLastUserOpHash(result.data.userOpHash);
  };

  /** World wallet must own an active mandate before raiseLimits — CLI demo payer ≠ phone wallet. */
  const onAuthorize = async () => {
    setBusy('authorize');
    setFeedback('pending');
    setErrorMsg(undefined);
    try {
      if (!wallet) throw new Error('No wallet address — open in World App and sign in');
      await sendCall(
        encodeFunctionData({
          abi: mandateAbi,
          functionName: 'authorize',
          args: [DEMO_HUMAN_ID, DEMO_TOKEN_ADDRESS, DEMO_INITIAL_CAP, DEMO_RECIPIENT],
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
      await sendCall(encodeFunctionData({ abi: mandateAbi, functionName: 'revoke' }));
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
          args: [capRaw, newRecipient as `0x${string}`, BigInt(step.deadline), step.signature],
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
  const usage = hasMandate ? capUsagePercent(mandate!.spentToday, mandate!.dailyCap) : 0;

  let statusLabel = 'Not set up';
  let statusBlurb = 'No spending card for this account yet.';
  let chipVariant: 'default' | 'success' | 'error' = 'default';
  if (hasMandate && mandate?.active) {
    statusLabel = 'On';
    statusBlurb = 'Your assistant can spend up to the daily limit, only to the locked payee.';
    chipVariant = 'success';
  } else if (hasMandate && mandate && !mandate.active) {
    statusLabel = 'Stopped';
    statusBlurb = 'Spending is frozen. Nothing new can go out.';
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
        <h1 className={styles.thesis}>
          A spending limit for your assistant — only you can raise it or stop it.
        </h1>
        <p className={styles.subcopy}>
          Like a company card: daily limit, one payee, freeze anytime.
        </p>
        <div className={styles.identityRow}>
          <div className={styles.identityMeta}>
            <div className={styles.identityLabel}>Signed in</div>
            <div className={styles.identityName}>{username ?? 'World App user'}</div>
          </div>
          <Marble src={avatar} className="w-11" />
        </div>
      </header>

      <ScenarioStrip selected={scenarioId} onSelect={onPickScenario} />

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
        <p className={styles.statusBlurb}>{statusBlurb}</p>

        {!wallet && (
          <p className={styles.warnNote}>Open this in World App to see your card.</p>
        )}
        {loadError && <p className={styles.errorBox}>{loadError}</p>}

        {hasMandate && mandate && (
          <>
            <dl className={styles.metrics}>
              <div>
                <dt className={styles.metricLabel}>Daily limit</dt>
                <dd className={styles.metricValue}>{formatUnitsLoose(mandate.dailyCap)}</dd>
              </div>
              <div>
                <dt className={styles.metricLabel}>Used today</dt>
                <dd className={styles.metricValue}>{formatUnitsLoose(mandate.spentToday)}</dd>
              </div>
              <div className={styles.metricWide}>
                <dt className={styles.metricLabel}>Pays only to</dt>
                <dd className={styles.metricValue}>{short(mandate.recipient)}</dd>
              </div>
            </dl>
            <div className={styles.capBar}>
              <Progress value={usage} className="w-full" />
              <p className={styles.capCaption}>
                {formatUnitsLoose(mandate.spentToday)} of {formatUnitsLoose(mandate.dailyCap)} used
                today
              </p>
            </div>
          </>
        )}

        {mandate?.empty && (
          <p className={styles.emptyNote}>
            No card on this World account yet. Turn one on below, then raise the limit with your
            face.
          </p>
        )}
        {hasMandate && mandate && !mandate.active && (
          <p className={styles.emptyNote}>Card stopped. Turn it back on to spend again.</p>
        )}

        <button type="button" className={styles.refreshBtn} onClick={() => void refresh()}>
          Refresh
        </button>
      </section>

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

        {lastUserOpHash && (
          <p className={styles.userOp}>
            Last UserOp: <span className={styles.userOpHash}>{lastUserOpHash}</span>
            {' — '}copy this for E2E proof.
          </p>
        )}

        {(!hasMandate || (mandate && !mandate.active)) && (
          <div className={styles.stepUp}>
            <Button
              type="button"
              variant="primary"
              size="lg"
              fullWidth
              onClick={() => void onAuthorize()}
              disabled={!!busy || !wallet}
            >
              Turn on card
            </Button>
            <p className={styles.hint}>
              Sets a daily limit and locked payee on this World wallet. Needs Dev Portal contract
              whitelist or sendTransaction fails.
            </p>
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
          <p className={styles.hint}>We’ll ask for your face before raising the limit.</p>
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

      <section className={styles.evidence}>
        <details className={styles.proofDetails}>
          <summary className={styles.proofSummary}>Proof details</summary>
          <p className={styles.evidenceIntro}>
            Technical proof for judges — App uses the NEW contract. Do not conflate OLD hashes with
            NEW.
          </p>

          {hasMandate && mandate && (
            <div className={styles.advancedIds}>
              <p className={styles.sectionLabel}>Advanced</p>
              <div className={styles.contractRow}>
                <span className={styles.contractLabel}>Person ID</span>
                <span className={styles.metricValue}>{mandate.humanId}</span>
              </div>
              <div className={styles.contractRow}>
                <span className={styles.contractLabel}>Your account</span>
                <span className={styles.metricValue}>{wallet ? short(wallet) : '—'}</span>
              </div>
              <p className={styles.hint}>
                Face check re-authenticates before raising limits — not Orb-grade Proof of Human.
                Contract must be whitelisted in Dev Portal for sendTransaction; without face check
                the contract reverts LivenessRequired.
              </p>
            </div>
          )}

          <p className={styles.sectionLabel}>
            OLD five-beat · {short(OLD_MANDATE_ADDRESS)}
          </p>
          <p className={styles.hint}>
            authorize / pull / CapExceeded / revoke / Agent B NotAuthorized (pre-step-up contract).
          </p>
          <ul className={styles.beatList}>
            {oldFiveBeat.map((b) => (
              <li key={b.tx} className={styles.beat}>
                <span className={`${styles.beatLabel} ${b.ok ? '' : styles.beatFail}`}>
                  {b.ok ? 'Pass' : 'Revert'} · {b.label}
                </span>
                <a
                  className={styles.beatLink}
                  href={explorerTx(b.tx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(b.tx)}
                </a>
              </li>
            ))}
          </ul>

          <p className={styles.sectionLabel}>
            NEW five-beat · {short(MANDATE_ADDRESS)}
          </p>
          <p className={styles.hint}>
            authorize / pull / CapExceeded / revoke / Agent B NotAuthorized on the App mandate.
          </p>
          <ul className={styles.beatList}>
            {newFiveBeat.map((b) => (
              <li key={b.tx} className={styles.beat}>
                <span className={`${styles.beatLabel} ${b.ok ? '' : styles.beatFail}`}>
                  {b.ok ? 'Pass' : 'Revert'} · {b.label}
                </span>
                <a
                  className={styles.beatLink}
                  href={explorerTx(b.tx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(b.tx)}
                </a>
              </li>
            ))}
          </ul>

          <p className={styles.sectionLabel}>
            NEW step-up · {short(MANDATE_ADDRESS)}
          </p>
          <p className={styles.hint}>
            LivenessRequired without Selfie; raiseLimits with EIP-712 attestation. Same NEW address
            the App shows and calls.
          </p>
          <ul className={styles.beatList}>
            {newStepUp.map((b) => (
              <li key={b.tx} className={styles.beat}>
                <span className={`${styles.beatLabel} ${b.ok ? '' : styles.beatFail}`}>
                  {b.ok ? 'Pass' : 'Revert'} · {b.label}
                </span>
                <a
                  className={styles.beatLink}
                  href={explorerTx(b.tx)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(b.tx)}
                </a>
              </li>
            ))}
          </ul>

          <div className={styles.contracts}>
            <div className={styles.contractRow}>
              <span className={styles.contractLabel}>App mandate (NEW)</span>
              <a
                className={styles.beatLink}
                href={explorerAddress(MANDATE_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {short(MANDATE_ADDRESS)}
              </a>
            </div>
            <div className={styles.contractRow}>
              <span className={styles.contractLabel}>Five-beat (OLD)</span>
              <a
                className={styles.beatLink}
                href={explorerAddress(OLD_MANDATE_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {short(OLD_MANDATE_ADDRESS)}
              </a>
            </div>
            <div className={styles.contractRow}>
              <span className={styles.contractLabel}>Registry</span>
              <a
                className={styles.beatLink}
                href={explorerAddress(REGISTRY_ADDRESS)}
                target="_blank"
                rel="noreferrer"
              >
                {short(REGISTRY_ADDRESS)}
              </a>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
