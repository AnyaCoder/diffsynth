'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { apiClient, isAuthorizedState } from '@/utils/api';

interface AuthWrapperProps {
  authRequired: boolean;
  children: React.ReactNode | React.ReactNode[];
}

export default function AuthWrapper({ authRequired, children }: AuthWrapperProps) {
  const tAuth = useTranslations('auth');
  const [token, setToken] = useState('');
  const [isAuthorizedGlobal, setIsAuthorized] = isAuthorizedState.use();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isAuthorized = authRequired ? isAuthorizedGlobal : true;

  useEffect(() => {
    const storedToken = localStorage.getItem('QWEN_UI_AUTH_TOKEN') || '';
    setToken(storedToken);
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthorized) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isAuthorized]);

  const checkAuth = async () => {
    const currentToken = localStorage.getItem('QWEN_UI_AUTH_TOKEN') || '';
    if (!authRequired || isLoading || currentToken === '') return;
    setIsLoading(true);
    setError('');
    try {
      await apiClient.get('/api/auth');
      setIsAuthorized(true);
    } catch {
      setIsAuthorized(false);
      setError(tAuth('invalidToken'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('QWEN_UI_AUTH_TOKEN', token);
    await checkAuth();
  };

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-950 flex-col justify-center p-12">
        <div className="max-w-lg">
          <p className="text-xs uppercase tracking-[0.3em] text-gray-500">DiffSynth Studio</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight">{tAuth('heroTitle')}</h1>
          <p className="mt-6 text-gray-400">{tAuth('heroDescription')}</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-8">
          <p className="text-sm uppercase tracking-[0.2em] text-gray-500">{tAuth('access')}</p>
          <h2 className="mt-3 text-2xl font-semibold">{tAuth('tokenTitle')}</h2>
          <p className="mt-2 text-sm text-gray-400">{tAuth('tokenHelp')}</p>
          <input
            ref={inputRef}
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            className="mt-6 w-full rounded-lg border border-gray-700 bg-gray-950 px-4 py-3 outline-none focus:border-blue-500"
            placeholder={tAuth('tokenPlaceholder')}
          />
          {error ? <div className="mt-3 rounded-lg border border-red-900 bg-red-950/50 px-3 py-2 text-sm text-red-200">{error}</div> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition hover:bg-blue-500 disabled:opacity-60"
          >
            {isLoading ? tAuth('checking') : tAuth('unlock')}
          </button>
        </form>
      </div>
    </div>
  );
}
