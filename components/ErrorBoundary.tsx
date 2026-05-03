"use client";

import { Component, type ReactNode } from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("ErrorBoundary caught", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8">
          <div className="card max-w-xl mx-auto text-center">
            <h3 className="font-heading text-h3 text-danger mb-2">Something went wrong</h3>
            <p className="text-sm text-muted mb-4">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
            <button
              className="btn-secondary"
              onClick={() => {
                if (typeof window !== "undefined") {
                  localStorage.removeItem("forecastiq-v1");
                  localStorage.removeItem("forecastiq-v2");
                  window.location.href = (process.env.NEXT_PUBLIC_BASE_PATH || "") + "/forecast/";
                }
              }}
            >
              Reset to Seed
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
