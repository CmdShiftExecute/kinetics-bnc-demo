import { Link, NavLink } from 'react-router';
import type { Meta } from '../../data/schema';
import { NAV } from '../lib/nav';

/** The masthead, the same shape as the MIS's: the brand block on the left, the system name centred at the page-heading size, the data-as-of stamp on the right, then the report navigation. The stock date is stated on every report page's head. */
export function Masthead({ meta }: { meta: Meta }) {
  return (
    <header className="mast">
      <div className="mast-row">
        <div className="mast-brand">
          <Link to="/" className="wordmark display" aria-label="Halvard, back to the overview">
            Halvard
          </Link>
          <span className="mast-division">{meta.division}</span>
        </div>
        <p className="mast-system display">{meta.system}</p>
        <dl className="stamp" aria-label="Reporting stamp">
          <div>
            <dt>Data as of</dt>
            <dd>{meta.dataAsOfLabel}</dd>
          </div>
        </dl>
      </div>
      <div className="nav-row">
        <nav className="nav" aria-label="Reports">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              {n.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}

export interface Crumb {
  to?: string;
  label: string;
}

/** Breadcrumb for drill pages: Overview, then the report, then the material group. */
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
