import { Component } from 'react';

/**
 * ErrorBoundary — catches uncaught JS errors in child component trees
 * and renders a styled fallback instead of crashing the whole app.
 *
 * Must be a class component — React's getDerivedStateFromError / componentDidCatch
 * APIs are not available in functional components.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to console for debugging — swap for a real logger if needed
    console.error('[StegaCrypt] Uncaught error in tool component:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const message = this.state.error?.message || 'An unexpected error occurred.';
      return (
        <div className="error-boundary-wrapper">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>
            <h3 className="error-boundary-title">Something went wrong</h3>
            <p className="error-boundary-message">{message}</p>
            <p className="error-boundary-hint">
              This may be caused by an unsupported file format or a corrupted file.
              Try a different file or refresh the page.
            </p>
            <div className="error-boundary-actions">
              <button className="btn btn-primary" onClick={this.handleReset}>
                Try again
              </button>
              <button className="btn btn-secondary" onClick={() => window.location.reload()}>
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
