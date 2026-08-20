'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('로그인 처리 중...');

  useEffect(() => {
    const supabase = createClient();

    const finishLogin = async () => {
      // URL에 있는 인증 정보로 세션 처리
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        setMessage('오류: ' + error.message);
        setTimeout(() => router.replace('/login'), 2000);
        return;
      }

      if (data.session) {
        setMessage('로그인 성공! 이동 중...');
        router.replace('/');
        return;
      }

      // 세션이 아직 없으면 잠시 후 다시 확인
      setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        if (retry.session) {
          router.replace('/');
        } else {
          setMessage('로그인에 실패했습니다. 다시 시도해주세요.');
          setTimeout(() => router.replace('/login'), 2000);
        }
      }, 1500);
    };

    finishLogin();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>{message}</p>
    </div>
  );
}