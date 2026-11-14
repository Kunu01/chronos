import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import CraveBookHome from './components/decoy/CraveBookHome';

// Strict Code-Splitting per TSD Section 4:
// The 3D Vault chunk and Admin Studio are lazy-loaded only when needed.
const VaultLayout = lazy(() => import('./components/vault/VaultLayout'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[CHRONOS GLOBAL ERROR]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#070A11] p-6 text-neutral-200">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-neutral-900/90 p-6 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-400">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-rose-400 font-bold">
                  SESSION NOTICE
                </span>
                <h2 className="text-base font-bold text-white">Something interrupted the view</h2>
              </div>
            </div>
            <p className="mt-4 text-xs font-mono text-neutral-400 bg-neutral-950/80 p-3 rounded-lg border border-white/5 break-words">
              {this.state.error?.message || 'An unexpected runtime error occurred.'}
            </p>
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/';
                }}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-neutral-300 hover:text-white"
              >
                Go to Recipes
              </button>
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.reload();
                }}
                className="rounded-xl border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
              >
                Reload App
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const RootGate = () => {
  const { isUnlocked } = useAuth();

  if (!isUnlocked) {
    return <CraveBookHome />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-[#121212] font-mono text-xs uppercase tracking-widest text-[#00F0FF]">
          [OPENING VAULT...]
        </div>
      }
    >
      <VaultLayout />
    </Suspense>
  );
};

const App = () => {
  return (
    <GlobalErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <SocketProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<RootGate />} />
                {/* Restrict /admin - redirect to decoy root */}
                <Route path="/admin" element={<Navigate to="/" replace />} />
                {/* Admin Panel accessed via /prodev */}
                <Route
                  path="/prodev"
                  element={
                    <Suspense
                      fallback={
                        <div className="flex h-[100dvh] w-full items-center justify-center bg-[#121212] font-mono text-xs uppercase text-[#00F0FF]">
                          [LOADING STUDIO...]
                        </div>
                      }
                    >
                      <AdminDashboard />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </SocketProvider>
        </AuthProvider>
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
};

export default App;

