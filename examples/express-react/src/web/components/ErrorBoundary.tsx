import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * `Can` and `Access` re-throw whatever the check rejected with — an
 * `UnknownRuleError` from a rule that was never registered in the browser, for
 * instance. That is a defect in the configuration, not a refusal, so it has to
 * become visible here instead of quietly hiding the interface.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  public override state: { error: Error | null } = { error: null };

  public static getDerivedStateFromError(error: Error) {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  public override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <div className="notice notice--error">
          <strong>{this.state.error.name}</strong>: {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}
