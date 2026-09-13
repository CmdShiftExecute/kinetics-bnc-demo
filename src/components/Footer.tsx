import type { Meta } from '../../data/schema';
import { Link } from 'react-router';

export function Footer({ meta }: { meta: Meta }) {
  return (
    <footer className="foot">
      <span>
        {meta.company}, {meta.division}. {meta.system}, register as of {meta.dataAsOfLabel}. Amounts in {meta.currency} {meta.unit}.
      </span>
      <span>
        Synthetic demonstration data. <Link to="/data-basis">Sources, rules and reconciliation</Link>
      </span>
    </footer>
  );
}
