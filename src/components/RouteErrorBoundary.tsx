import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Catches render-phase errors in lazy-loaded routes and shows a useful
 * message instead of a silent blank page.
 *
 * Why this exists: when a lazy chunk fails to load (network blip, stale
 * Vite cache, syntax error in a page) OR a page throws on mount, React 18
 * unmounts the subtree and — without a boundary — renders nothing. The user
 * sees a blank screen and assumes the app is broken. With this boundary, we
 * at least surface the error message + a reload button, and log the stack
 * to the console so the dev can act on it.
 *
 * Placed inside <Suspense> in App.tsx so it catches both:
 *   - render errors in the page (e.g. `Cannot read property 'x' of undefined`)
 *   - rejections from the lazy `import()` itself
 */
interface State {
  error: Error | null;
}

export default class RouteErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log so the failure is visible in DevTools console even when the
    // user is on a production build with minified stacks.
    // eslint-disable-next-line no-console
    console.error("RouteErrorBoundary caught:", error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    // Hard reload as a last resort — clears any in-flight Suspense + stale
    // lazy-chunk import promise that might otherwise re-throw immediately.
    if (typeof window !== "undefined") window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-4">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
            <h2 className="font-display font-semibold text-lg">Something went wrong</h2>
            <p className="text-sm text-muted-foreground">
              {this.state.error.message || "An unexpected error occurred while loading this page."}
            </p>
            <details className="text-left text-xs bg-muted rounded-md p-3 overflow-auto max-h-64">
              <summary className="cursor-pointer font-medium">Technical details</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words">
                {this.state.error.stack ?? String(this.state.error)}
              </pre>
            </details>
            <button
              onClick={this.reset}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
