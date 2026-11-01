import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Keeps the shell usable if a single page throws; offers a reset of locally stored data. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('STEELHUNT page error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <h2 className="font-display text-2xl uppercase tracking-wide">Coś poszło nie tak</h2>
        <p className="mt-2 text-sm text-ink-400">{this.state.error.message}</p>
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-ghost" onClick={() => this.setState({ error: null })}>
            Spróbuj ponownie
          </button>
          <button
            className="btn-ghost"
            onClick={() => {
              try {
                Object.keys(localStorage)
                  .filter((k) => k.startsWith('steelhunt.settings'))
                  .forEach((k) => localStorage.removeItem(k));
              } catch {
                /* ignore */
              }
              location.reload();
            }}
          >
            Przywróć ustawienia domyślne
          </button>
        </div>
      </div>
    );
  }
}
