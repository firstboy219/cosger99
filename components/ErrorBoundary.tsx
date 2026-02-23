import React, { ReactNode, ErrorInfo } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../services/api';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage?: string;
  errorStack?: string;
  route?: string;
}

/**
 * V50.35 TAHAP 2: Global Error Boundary
 * Catches all unhandled UI errors and sends telemetry to backend
 * Renders a friendly fallback UI instead of white screen
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message,
      errorStack: error.stack,
      route: window.location.hash
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Send crash telemetry to backend silently
    this.sendCrashTelemetry({
      errorMessage: error.message,
      stackTrace: errorInfo.componentStack,
      route: window.location.hash
    });
  }

  private sendCrashTelemetry = async (data: any) => {
    try {
      const userId = localStorage.getItem('paydone_active_user') || 'unknown';
      const browserInfo = {
        userAgent: navigator.userAgent,
        language: navigator.language,
        platform: navigator.platform,
        screenResolution: `${window.innerWidth}x${window.innerHeight}`
      };
      
      const stateSnapshot = {
        localStorage: {
          hasToken: !!localStorage.getItem('paydone_session_token'),
          userId: localStorage.getItem('paydone_active_user')
        }
      };

      await api.post('/telemetry/crash', {
        userId,
        errorMessage: data.errorMessage,
        stackTrace: data.stackTrace,
        route: data.route,
        browserInfo,
        stateSnapshot,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      // Fail silently - don't create infinite error loop
      console.error('[ErrorBoundary] Failed to send crash telemetry:', e);
    }
  };

  handleReset = () => {
    this.setState({ hasError: false });
    window.location.hash = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-8 flex flex-col items-center gap-3">
              <AlertCircle className="w-12 h-12 text-white" />
              <h1 className="text-xl font-black text-white text-center">Oops, Something Went Wrong</h1>
            </div>

            {/* Content */}
            <div className="px-6 py-8 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                We encountered an unexpected error. Our team has been notified and is looking into it.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.errorMessage && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="text-xs font-mono text-slate-700 break-words">
                    {this.state.errorMessage}
                  </p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Error ID:</strong> {Date.now()}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-4">
                <button
                  onClick={this.handleReset}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  Go Back to Dashboard
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="w-full py-3 bg-slate-200 text-slate-700 font-semibold rounded-lg hover:bg-slate-300 transition-all"
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
