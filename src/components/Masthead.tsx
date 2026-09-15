import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router';
import type { Meta } from '../../data/schema';
import { NAV } from '../lib/nav';
import { ThemeControl } from './ThemeControl';
import { IconMenu } from './IconMenu';

/** Persistent technical masthead: reporting context, modules, theme and report navigation. */
export function Masthead({ meta }: { meta: Meta }) {
  const header = useRef<HTMLElement>(null);
  const [sections, setSections] = useState<{ id: string; label: string }[]>([]);
  const [section, setSection] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    const element = header.current;
    if (!element) return;
    // Clearance includes the existing page/section entrance transforms.
    const measure = () => document.documentElement.style.setProperty('--mast-offset', `${element.getBoundingClientRect().height + 32}px`);
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure();
    setSections(Array.from(element.closest('main')?.querySelectorAll<HTMLElement>('section.sec[id]') ?? []).map(section => ({ id: section.id, label: section.querySelector('h2')?.textContent ?? section.id })));
    return () => observer.disconnect();
  }, []);
  return (
    <header className="mast" ref={header}>
      <div className="mast-row">
        <div className="mast-brand">
          <Link to="/" className="wordmark display" aria-label="Halvard, back to the overview">
            Halvard
          </Link>
          <span className="mast-division">{meta.division}</span>
        </div>
        <div className="mast-identity">
          <p className="mast-system display">Project Intelligence System</p>
          <dl className="stamp" aria-label="Reporting stamp">
            <div>
              <dt>Register as of</dt>
              <dd>{meta.dataAsOfLabel}</dd>
            </div>
          </dl>
        </div>
        <div className="mast-tools">
          <IconMenu label="Module" icon={<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></svg>}>
            <a role="menuitem" tabIndex={-1} href="https://node-ss.tail640a1e.ts.net:926/">Group MIS</a>
            <a role="menuitem" tabIndex={-1} href="https://node-ss.tail640a1e.ts.net:927/">Central Store</a>
            <Link role="menuitem" tabIndex={-1} to="/" aria-current="true"><span>Project Intelligence</span><span className="menu-check" aria-hidden="true">✓</span></Link>
          </IconMenu>
          <ThemeControl />
        </div>
      </div>
      <nav className="nav" aria-label="Reports">
        <div className="nav-reports">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </div>
        <div className="nav-actions">
          {sections.length > 0 && <form className="section-control" onSubmit={(event) => {
            event.preventDefault();
            if (!section) return;
            navigate(`#${section}`);
            // Continue keyboard reading at the chosen section, rather than back in the masthead.
            requestAnimationFrame(() => {
              document.getElementById(section)?.scrollIntoView({ block: 'start' });
              document.getElementById(`${section}-title`)?.focus({ preventScroll: true });
            });
          }}>
            <select className="section-select" aria-label="Jump to section" value={section} onChange={(event) => setSection(event.target.value)}>
              <option value="">On this page</option>
              {sections.map(section => <option key={section.id} value={section.id}>{section.label}</option>)}
            </select>
            <button className="nav-action" type="submit" aria-label="Go to selected section" disabled={!section}>Go</button>
          </form>}
        </div>
      </nav>
    </header>
  );
}

export interface Crumb {
  to?: string;
  label: string;
}

/** Breadcrumb for drill pages: Overview, then the vertical, then the engineer or the aging table. */
export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="You are here">
      <ol>
        <li>
          <Link to="/">Overview</Link>
        </li>
        {items.map((c, i) => (
          <li key={i} aria-current={c.to ? undefined : 'page'}>
            {c.to ? <Link to={c.to}>{c.label}</Link> : <span>{c.label}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
