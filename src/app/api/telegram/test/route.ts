import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { sendTelegramMessage } from '@/lib/telegram';
import { getSupabaseUrl } from '@/lib/supabase/url';

export async function POST() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    getSupabaseUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('telegram_chat_id')
    .eq('id', user.id)
    .single();

  if (error || !profile?.telegram_chat_id) {
    return NextResponse.json(
      { error: '설정에 텔레그램 Chat ID를 먼저 저장하세요.' },
      { status: 400 }
    );
  }

  const result = await sendTelegramMessage(
    profile.telegram_chat_id,
    '[구독 킬러] 테스트 알림입니다.\n텔레그램 연결이 정상입니다.'
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || '텔레그램 발송 실패' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
