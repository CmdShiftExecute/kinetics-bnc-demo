import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { ErrorBlock } from './Skeleton';

interface State {
  error: Error | null;
}

/** Catches a render error on one route and shows a readable message instead of a blank page. */
/** Mount with key={pathname} so a navigation replaces the boundary and clears the error. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Route render failed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="wrap" style={{ paddingTop: 'var(--s-2xl)' }}>
          <ErrorBlock title="This page could not be drawn" message={this.state.error.message} />
        </div>
      );
    }
    return this.props.children;
  }
}
