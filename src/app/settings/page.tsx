'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [email, setEmail] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || '');

        const { data } = await supabase
          .from('profiles')
          .select('telegram_chat_id')
          .eq('id', user.id)
          .single();

        if (data?.telegram_chat_id) {
          setTelegramChatId(data.telegram_chat_id);
        }
      }
    };

    fetchUser();
  }, []);

  const handleSaveTelegram = async () => {
    setLoading(true);
    setMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const cleaned = telegramChatId.trim();

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      telegram_chat_id: cleaned,
    });

    if (error) {
      setMessage('저장 실패: ' + error.message);
    } else {
      setTelegramChatId(cleaned);
      setMessage('텔레그램 연결이 저장되었습니다.');
    }

    setLoading(false);
  };

  const handleTestTelegram = async () => {
    setTesting(true);
    setMessage('');

    try {
      const res = await fetch('/api/telegram/test', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        setMessage('테스트 실패: ' + (data.error || '알 수 없는 오류'));
      } else {
        setMessage('테스트 알림을 보냈습니다. 텔레그램을 확인하세요.');
      }
    } catch {
      setMessage('테스트 요청 중 오류가 발생했습니다.');
    }

    setTesting(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">설정</h1>

      <div className="bg-white rounded-xl p-4 mb-4">
        <p className="text-sm text-gray-500">로그인 이메일</p>
        <p className="font-medium">{email}</p>
      </div>

      <div className="bg-white rounded-xl p-4 mb-4 space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">텔레그램 Chat ID</label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="예: 123456789"
            className="w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            텔레그램 봇에게 /start를 보낸 후 Chat ID를 입력하세요.
          </p>
        </div>

        <button
          onClick={handleSaveTelegram}
          disabled={loading}
          className="w-full bg-black text-white py-2.5 rounded-lg"
        >
          {loading ? '저장 중...' : '텔레그램 연결 저장'}
        </button>

        <button
          onClick={handleTestTelegram}
          disabled={testing || !telegramChatId}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg disabled:opacity-50"
        >
          {testing ? '보내는 중...' : '테스트 알림 보내기'}
        </button>

        {message && (
          <p className="text-sm text-center text-gray-700 whitespace-pre-wrap">{message}</p>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-medium"
      >
        로그아웃
      </button>
    </div>
  );
}
