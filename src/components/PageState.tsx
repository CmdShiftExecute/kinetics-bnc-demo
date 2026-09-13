import { ErrorBlock, TableSkeleton } from './Skeleton';

export function PageError({ message, back }: { message: string; back?: { to: string; label: string } }) {
  return (
    <div className="wrap">
      <ErrorBlock message={message} back={back} />
    </div>
  );
}

export function PageLoading({ rows = 10 }: { rows?: number }) {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
      <TableSkeleton rows={rows} />
    </div>
  );
}
