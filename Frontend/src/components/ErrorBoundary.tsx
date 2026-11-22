import React, { Component, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { formatErrorMessage } from '../lib/errorBoundary';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, errorMessage: formatErrorMessage(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Unhandled UI exception in component tree:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="flex flex-col items-center max-w-md w-full bg-white rounded-3xl border border-rose-100 shadow-xl p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-500 mb-4 shadow-inner">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-base font-black text-slate-800 uppercase tracking-tight">
              {this.props.fallbackTitle || 'Terjadi Kendala Tampilan'}
            </h2>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Komponen ini mengalami kendala tak terduga. Data Anda aman. Silakan muat ulang komponen ini atau kembali ke Beranda.
            </p>
            {this.state.errorMessage && (
              <div className="w-full mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left">
                <p className="text-[10px] font-mono font-bold text-rose-600 break-all">
                  {this.state.errorMessage}
                </p>
              </div>
            )}
            <div className="flex gap-2.5 w-full mt-6">
              <button
                type="button"
                onClick={() => { window.location.href = '/'; }}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Home size={14} /> Beranda
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors shadow-md shadow-rose-600/20 cursor-pointer"
              >
                <RefreshCw size={14} /> Coba Lagi
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
