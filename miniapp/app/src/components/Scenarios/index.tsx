'use client';

import { getScenario, scenarios, type ScenarioId } from '@/lib/scenarios';
import styles from './Scenarios.module.css';

type ScenarioStripProps = {
  selected: ScenarioId;
  onSelect: (id: ScenarioId) => void;
};

export function ScenarioStrip({ selected, onSelect }: ScenarioStripProps) {
  const scenario = getScenario(selected);

  return (
    <section className={styles.strip} aria-label="Who this is for">
      <p className={styles.eyebrow}>Who this is for</p>

      <div className={styles.tabs} role="tablist" aria-label="Example situations">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={s.id === selected}
            className={`${styles.tab} ${s.id === selected ? styles.tabActive : ''}`}
            onClick={() => onSelect(s.id)}
          >
            {s.tab}
          </button>
        ))}
      </div>

      <div className={styles.detail} aria-live="polite">
        <p className={styles.who}>
          <span className={styles.person}>{scenario.person}</span> — {scenario.who}
        </p>
        <p className={styles.pain}>{scenario.pain}</p>
        <p className={styles.setup}>{scenario.setup}</p>
        <p className={styles.familiar}>{scenario.familiar}</p>
        <p className={styles.applied}>
          Limit box below set to {scenario.dailyLimit} a day — change it before you raise.
        </p>
      </div>

      <p className={styles.footnote}>
        World App is the remote control: you set the limit and stop the card here. The money sits in
        a separate spending account, because World App clears approvals after every transaction.
      </p>
    </section>
  );
}
