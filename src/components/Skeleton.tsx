import { Link } from 'react-router';

/** A loading state shaped like the table it replaces. */
export function TableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="skel" aria-busy="true" aria-label="Loading">
      <div className="h" />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} style={{ width: `${92 - (i % 4) * 6}%` }} />
      ))}
    </div>
  );
}

export function ErrorBlock({ title = 'Data not loaded', message, back }: { title?: string; message: string; back?: { to: string; label: string } }) {
  return (
    <div className="errbox" role="alert">
      <p className="display sec-title bad">{title}</p>
      <p style={{ margin: 'var(--s-sm) 0 0' }}>{message}</p>
      <p className="muted" style={{ margin: 'var(--s-sm) 0 0' }}>
        Nothing you did caused this. The page reads published tables; if they cannot be read, try again, or go back and choose another report.
      </p>
      <div style={{ display: 'flex', gap: 'var(--s-md)', flexWrap: 'wrap' }}>
        <button type="button" className="drill-link press" onClick={() => window.location.reload()}>
          Try again
        </button>
        <Link to={back?.to ?? '/'} className="drill-link press">
          {back?.label ?? 'Back to the overview'}
        </Link>
      </div>
    </div>
  );
}
