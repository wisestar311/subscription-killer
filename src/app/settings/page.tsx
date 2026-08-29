'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function SettingsPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [currentBalance, setCurrentBalance] = useState<number | null>(null);
  const [balanceUpdatedAt, setBalanceUpdatedAt] = useState<string | null>(null);
  const [importToken, setImportToken] = useState('');
  const [endpoint, setEndpoint] = useState('/api/balance/import');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchSettings = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      router.replace('/login');
      return;
    }

    setEmail(user.email || '');
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('telegram_chat_id, current_balance, balance_updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setError('설정을 불러오지 못했습니다. 데이터베이스 migration 적용 여부를 확인해주세요.');
      return;
    }

    setTelegramChatId(data?.telegram_chat_id || '');
    setCurrentBalance(data?.current_balance ?? null);
    setBalanceUpdatedAt(data?.balance_updated_at ?? null);
  }, [router, supabase]);

  useEffect(() => {
    setEndpoint(`${window.location.origin}/api/balance/import`);
    void fetchSettings();
  }, [fetchSettings]);

  async function saveTelegram() {
    setLoading(true);
    setMessage('');
    setError('');
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    const cleaned = telegramChatId.trim();
    const { error: saveError } = await supabase.from('profiles').upsert({
      id: user.id,
      telegram_chat_id: cleaned || null,
      updated_at: new Date().toISOString(),
    });

    if (saveError) setError(`텔레그램 설정을 저장하지 못했습니다: ${saveError.message}`);
    else {
      setTelegramChatId(cleaned);
      setMessage('텔레그램 연결을 저장했습니다.');
    }
    setLoading(false);
  }

  async function testTelegram() {
    setTesting(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/telegram/test', { method: 'POST' });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) setError(result.error || '텔레그램 테스트 발송에 실패했습니다.');
      else setMessage('테스트 알림을 보냈습니다. 텔레그램을 확인하세요.');
    } catch {
      setError('텔레그램 테스트 요청 중 오류가 발생했습니다.');
    }
    setTesting(false);
  }

  async function generateImportToken() {
    setLoading(true);
    setMessage('');
    setError('');
    const response = await fetch('/api/balance/token', { method: 'POST' });
    const result = (await response.json()) as { token?: string; error?: string };

    if (!response.ok || !result.token) {
      setError(result.error || '연동 토큰을 만들지 못했습니다.');
    } else {
      setImportToken(result.token);
      setMessage('새 연동 토큰을 만들었습니다. 이 화면을 닫기 전에 단축어에 복사하세요.');
    }
    setLoading(false);
  }

  async function revokeImportToken() {
    if (!window.confirm('iPhone 메시지 잔액 연동을 해제하시겠습니까?')) return;
    setLoading(true);
    const response = await fetch('/api/balance/token', { method: 'DELETE' });
    if (response.ok) {
      setImportToken('');
      setMessage('잔액 연동을 해제했습니다.');
      setError('');
    } else {
      setError('잔액 연동을 해제하지 못했습니다.');
    }
    setLoading(false);
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label}을 복사했습니다.`);
    } catch {
      setError('클립보드에 복사하지 못했습니다. 직접 선택해 복사해주세요.');
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  const shortcutBody = importToken
    ? JSON.stringify({ token: importToken, message: '단축어 입력' }, null, 2)
    : '';
  const authorizationHeader = importToken ? `Bearer ${importToken}` : '';

  return (
    <main className="app-shell min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="back-link">← 캘린더</Link>
          <span className="text-xs text-slate-400">{email}</span>
        </div>

        <div className="mb-7">
          <p className="eyebrow">CONNECTIONS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">설정</h1>
        </div>

        {(message || error) && (
          <p
            className={`mb-5 rounded-xl p-3 text-sm ${
              error ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || message}
          </p>
        )}

        <section className="form-card mb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">CURRENT BALANCE</p>
              <h2 className="mt-2 text-lg font-semibold">iPhone 메시지 잔액 연동</h2>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold">
                {currentBalance === null ? '미연동' : `${currentBalance.toLocaleString('ko-KR')}원`}
              </p>
              {balanceUpdatedAt && (
                <p className="mt-1 text-[11px] text-slate-400">
                  {new Date(balanceUpdatedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          </div>

          <p className="mt-4 text-sm leading-6 text-slate-500">
            브라우저는 iPhone 메시지에 직접 접근할 수 없습니다. iOS 단축어의 메시지 자동화가
            은행 문자를 이 앱으로 전달하면, 원문은 저장하지 않고 잔액 숫자만 반영합니다.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button className="primary-button" disabled={loading} onClick={generateImportToken}>
              {importToken ? '토큰 다시 만들기' : '연동 토큰 만들기'}
            </button>
            <button className="danger-button" disabled={loading} onClick={revokeImportToken}>
              연동 해제
            </button>
          </div>

          {importToken && (
            <div className="mt-6 space-y-4 rounded-2xl bg-slate-50 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">1. 요청 URL</span>
                  <button
                    className="text-xs font-semibold text-blue-600"
                    onClick={() => copyText(endpoint, '요청 URL')}
                  >
                    복사
                  </button>
                </div>
                <code className="block overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                  {endpoint}
                </code>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">2. Authorization 헤더</span>
                  <button
                    className="text-xs font-semibold text-blue-600"
                    onClick={() => copyText(authorizationHeader, 'Authorization 헤더')}
                  >
                    복사
                  </button>
                </div>
                <code className="block overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-100">
                  {authorizationHeader}
                </code>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-600">기존 방식: POST JSON 본문</span>
                  <button
                    className="text-xs font-semibold text-blue-600"
                    onClick={() => copyText(shortcutBody, 'JSON 본문')}
                  >
                    복사
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-slate-900 p-3 text-xs leading-5 text-slate-100">
                  {shortcutBody}
                </pre>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-xs leading-5 text-slate-500">
                <li>단축어 앱 → 자동화 → 메시지를 받을 때를 선택합니다.</li>
                <li>은행 발신자를 지정하고 “URL 콘텐츠 가져오기” 동작을 추가합니다.</li>
                <li>메서드는 POST, Authorization 헤더에는 위 값을 입력합니다.</li>
                <li>요청 본문은 파일로 선택하고 값에는 단축어 입력을 지정합니다.</li>
              </ol>
              <p className="text-xs font-medium text-amber-700">
                토큰 원문은 다시 표시되지 않습니다. 노출되면 즉시 새 토큰을 만드세요.
              </p>
            </div>
          )}
        </section>

        <section className="form-card mb-4">
          <p className="eyebrow">TELEGRAM</p>
          <h2 className="mt-2 text-lg font-semibold">결제 전 알림</h2>
          <label htmlFor="telegram-chat-id" className="field-label mt-5">Telegram Chat ID</label>
          <input
            id="telegram-chat-id"
            type="text"
            value={telegramChatId}
            onChange={(event) => setTelegramChatId(event.target.value)}
            placeholder="예: 123456789"
            inputMode="numeric"
            className="field-input"
          />
          <p className="mt-2 text-xs leading-5 text-slate-400">
            봇에게 /start를 보낸 뒤 Chat ID를 입력하면 결제 이틀 전에 알림을 받습니다.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button className="primary-button w-full" disabled={loading} onClick={saveTelegram}>
              텔레그램 설정 저장
            </button>
            <button
              className="secondary-button w-full"
              disabled={testing || !telegramChatId.trim()}
              onClick={testTelegram}
            >
              {testing ? '보내는 중…' : '테스트 알림 보내기'}
            </button>
          </div>
        </section>

        <button className="danger-button mt-4 w-full" onClick={handleLogout}>로그아웃</button>
      </div>
    </main>
  );
}
