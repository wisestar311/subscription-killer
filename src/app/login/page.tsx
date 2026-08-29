'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = useMemo(() => createClient(), []);
  const searchParams = useSearchParams();

  // 예전에 입력한 이메일 불러오기
  useEffect(() => {
    const saved = localStorage.getItem('saved_email');
    if (saved) setEmail(saved);
    const loginError = searchParams.get('error');
    if (loginError) setMessage(loginError);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    // 이메일 저장
    localStorage.setItem('saved_email', email.trim());

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage('오류: ' + error.message);
    } else {
      setMessage('이메일을 확인해주세요! 로그인 링크가 발송되었습니다.');
    }

    setLoading(false);
  };

  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-4">
      <div className="form-card w-full max-w-sm">
        <p className="eyebrow text-center">EXPENDITURE CONTROL</p>
        <h1 className="mb-2 mt-2 text-center text-2xl font-semibold">구독 킬러</h1>
        <p className="mb-7 text-center text-sm leading-6 text-slate-500">
          지출 일정과 잔액을 한눈에 관리하세요
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoComplete="email"
              className="field-input"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="primary-button w-full"
          >
            {loading ? '발송 중...' : '로그인 링크 받기'}
          </button>
        </form>

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
