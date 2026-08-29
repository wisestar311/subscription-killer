import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL('/', url.origin));
    console.error('인증 코드 교환 오류:', error);
  }

  const loginUrl = new URL('/login', url.origin);
  loginUrl.searchParams.set('error', 'Google 인증에 실패했거나 요청이 만료되었습니다.');
  return NextResponse.redirect(loginUrl);
}
