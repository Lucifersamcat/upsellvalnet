import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center">
          <div className="text-5xl">⚠️</div>
          <h1 className="text-xl font-bold text-slate-800">Algo salió mal</h1>
          <p className="max-w-md text-sm text-slate-500">{this.state.error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };
