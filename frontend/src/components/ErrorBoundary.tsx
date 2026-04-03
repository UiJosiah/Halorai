import { Component, type ErrorInfo, type ReactNode } from "react";
import { log } from "@/lib/logger";

type Props = { children: ReactNode };
type State = { hasError: boolean };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log("error", "react.error_boundary", { message: error.message, stack: error.stack, componentStack: info.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md w-full border border-[hsl(0,0%,85%)] rounded-2xl p-6 bg-white">
            <div className="text-lg font-semibold text-[hsl(0,0%,10%)]">Something went wrong</div>
            <div className="mt-2 text-sm text-[hsl(0,0%,45%)]">
              Please refresh the page. If it keeps happening, contact support.
            </div>
            <button
              className="mt-5 w-full bg-[hsl(0,0%,10%)] text-white rounded-full px-4 py-3 text-sm font-medium hover:bg-[hsl(0,0%,20%)] transition-colors border-none"
              onClick={() => window.location.reload()}
            >
              Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

