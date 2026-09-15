import { Suspense, lazy, useEffect, useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TableSkeleton } from './components/Skeleton';
import Overview from './pages/Overview';

const RelevancePage = lazy(() => import('./pages/RelevancePage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const EngineersPage = lazy(() => import('./pages/EngineersPage'));
const EngineerPage = lazy(() => import('./pages/EngineerPage'));
const PartiesPage = lazy(() => import('./pages/PartiesPage'));
const ProjectPage = lazy(() => import('./pages/ProjectPage'));
const DataBasis = lazy(() => import('./pages/DataBasis'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Fallback() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--s-3xl)' }}>
      <TableSkeleton rows={8} />
    </div>
  );
}

/** Scroll to the top on every path change, or to the anchor when the address carries one. The search string alone never scrolls: a filter change keeps the reader where they are. */
function ScrollManager() {
  const { pathname, hash, search, key } = useLocation();
  const previous = useRef<{ pathname: string; hash: string; search: string } | null>(null);
  useEffect(() => {
    const last = previous.current;
    previous.current = { pathname, hash, search };
    if (last && last.pathname === pathname && last.hash === hash && last.search !== search) return;
    if (!hash) { window.scrollTo({ top: 0 }); return; }
    // A direct anchor can precede lazy route and JSON loading. Resolve only on the destination.
    const scroll = () => {
      const el = document.getElementById(hash.slice(1));
      if (!el || el.closest('main')?.dataset.page !== pathname) return false;
      el.scrollIntoView({ block: 'start' });
      return true;
    };
    if (scroll()) return;
    const observer = new MutationObserver(() => { if (scroll()) observer.disconnect(); });
    observer.observe(document.getElementById('root')!, { childList: true, subtree: true });
    const timeout = window.setTimeout(() => observer.disconnect(), 10000);
    return () => { observer.disconnect(); window.clearTimeout(timeout); };
  }, [pathname, hash, search, key]);
  return null;
}

function Pages() {
  const location = useLocation();
  const reduce = useReducedMotion();
  const page = reduce ? {} : { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0 }, transition: { duration: 0.2 } };
  // No `initial={false}` on AnimatePresence: that flag suppresses the entry animation of
  // every motion component beneath it on first load (measured on the siblings, 13 Sep 2026).
  return (
    <AnimatePresence mode="wait">
      <motion.main data-page={location.pathname} key={location.pathname} {...page}>
        {!reduce && <motion.div key={`rule-${location.pathname}`} className="entry-rule" aria-hidden="true" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }} />}
        <ErrorBoundary key={location.pathname}>
          <Suspense fallback={<Fallback />}>
            <Routes location={location}>
              <Route path="/" element={<Overview />} />
              <Route path="/relevance" element={<RelevancePage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/engineers" element={<EngineersPage />} />
              <Route path="/engineers/:slug" element={<EngineerPage />} />
              <Route path="/parties" element={<PartiesPage />} />
              <Route path="/p/:ref" element={<ProjectPage />} />
              <Route path="/data-basis" element={<DataBasis />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </motion.main>
    </AnimatePresence>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <ScrollManager />
      <Pages />
    </BrowserRouter>
  );
}
