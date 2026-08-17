import * as React from "react";
import * as Sentry from "@sentry/react-native";

type ErrorBoundaryProps = {
  fallback: React.ReactNode;
  children?: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static displayName = "ErrorBoundary";

  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    try {
      if (__DEV__) {
        console.warn("[ErrorBoundary]", error, info);
      } else {
        Sentry.captureException(error, {
          contexts: { react: { componentStack: info.componentStack ?? undefined } },
        });
      }
    } catch {
      // never throw from error boundary handler
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}
