'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  useEffect(() => {
    const loginError = searchParams.get('error');
    if (loginError) setMessage(loginError);
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage(`Google 로그인 오류: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-4">
      <div className="form-card w-full max-w-sm">
        <p className="eyebrow text-center">EXPENDITURE CONTROL</p>
        <h1 className="mb-2 mt-2 text-center text-2xl font-semibold">구독 킬러</h1>
        <p className="mb-7 text-center text-sm leading-6 text-slate-500">
          지출 일정과 잔액을 한눈에 관리하세요
        </p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="primary-button flex w-full items-center justify-center gap-3"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" role="img">
            <path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.55h3.24c1.9-1.75 2.98-4.33 2.98-7.42Z" />
            <path fill="#34A853" d="M12 22c2.7 0 4.98-.9 6.63-2.35l-3.24-2.55c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.63A10 10 0 0 0 12 22Z" />
            <path fill="#FBBC05" d="M6.39 13.93A6.02 6.02 0 0 1 6.07 12c0-.67.11-1.32.32-1.93V7.44H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.56l3.35-2.63Z" />
            <path fill="#EA4335" d="M12 5.94c1.47 0 2.79.5 3.83 1.5l2.87-2.88A9.64 9.64 0 0 0 12 2a10 10 0 0 0-8.96 5.44l3.35 2.63C7.18 7.7 9.39 5.94 12 5.94Z" />
          </svg>
          {loading ? 'Google로 이동 중...' : 'Google로 계속하기'}
        </button>

        <p className="mt-4 text-center text-xs leading-5 text-slate-400">
          Google 계정으로 안전하게 로그인합니다.
        </p>

        {message && (
          <p className="mt-4 text-center text-sm text-slate-600">{message}</p>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="app-shell min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
