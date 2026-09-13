import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cx } from '../lib/format';
import { CHART_EASE } from './ChartMotion';

export interface ChartView {
  key: string;
  label: string;
  render: () => ReactNode;
}

/**
 * One chart, several readings: a print-style segmented control naming each view,
 * as on the MIS. The choice survives navigation within the tab. Keying the wrapper
 * remounts the chart so each view replays its own entrance; there is deliberately
 * no AnimatePresence here.
 */
export function ChartSwitch({ id, views, defaultKey, note }: { id: string; views: ChartView[]; defaultKey?: string; note?: string }) {
  const reduce = useReducedMotion();
  const fallback = defaultKey ?? views[0]!.key;
  const [key, setKey] = useState(() => {
    try {
      const stored = sessionStorage.getItem(`chart-view:${id}`);
      return stored && views.some((v) => v.key === stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });
  const active = views.find((v) => v.key === key) ?? views[0]!;
  const choose = (next: string) => {
    setKey(next);
    try {
      sessionStorage.setItem(`chart-view:${id}`, next);
    } catch {
      /* the view still switches; it is simply not remembered */
    }
  };
  return (
    <div className="chart-views" id={`${id}-views`}>
      <div className="cv-bar">
        <span className="cv-name">{note ?? active.label}</span>
        <div className="seg-row tight" role="group" aria-label="Chart view">
          {views.map((v) => (
            <button key={v.key} type="button" className={cx('segb small press', v.key === active.key && 'on')} aria-pressed={v.key === active.key} data-view={v.key} onClick={() => choose(v.key)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <motion.div key={active.key} {...(reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, ease: CHART_EASE } })}>
        {active.render()}
      </motion.div>
      <p className="sr-only" aria-live="polite">
        {`Chart shown as ${active.label.toLowerCase()}`}
      </p>
    </div>
  );
}
