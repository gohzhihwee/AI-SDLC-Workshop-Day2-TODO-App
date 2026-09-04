'use client';

import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

type AuthMode = 'register' | 'login';

async function apiRequest<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? 'Request failed');
  }

  return data;
}

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [mode, setMode] = useState<AuthMode>('register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setError('Username is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        const options = await apiRequest<Parameters<typeof startRegistration>[0]['optionsJSON']>('/api/auth/register-options', { username: trimmed });
        const response = await startRegistration({ optionsJSON: options });
        await apiRequest('/api/auth/register-verify', { username: trimmed, response });
      } else {
        const options = await apiRequest<Parameters<typeof startAuthentication>[0]['optionsJSON']>('/api/auth/login-options', { username: trimmed });
        const response = await startAuthentication({ optionsJSON: options });
        await apiRequest('/api/auth/login-verify', { username: trimmed, response });
      }

      router.replace('/');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200 dark:bg-slate-900 dark:shadow-none">
        <div className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-bold">Todo App</h1>
          <p className="text-sm text-slate-600 dark:text-slate-300">Sign in securely with a passkey.</p>
        </div>

        <div className="mb-6 flex gap-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          {(['register', 'login'] as AuthMode[]).map((value) => (
            <button
              key={value}
              type="button"
              data-testid={`${value}-tab`}
              onClick={() => setMode(value)}
              className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                mode === value ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'text-slate-700 dark:text-slate-200'
              }`}
            >
              {value === 'register' ? 'Register' : 'Login'}
            </button>
          ))}
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm font-medium">Username</span>
            <input
              data-testid="username-input"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="e.g. taylor"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none ring-0 focus:border-slate-500 dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          {error ? (
            <div data-testid="auth-error" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </div>
          ) : null}

          <button
            data-testid={`${mode}-button`}
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Please wait...' : mode === 'register' ? 'Create passkey' : 'Sign in with passkey'}
          </button>
        </form>
      </div>
    </main>
  );
}
