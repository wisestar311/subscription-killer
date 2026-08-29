import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeBalance,
  parseBalanceFromMessage,
  parseBalanceImportPayload,
} from '@/lib/balance';
import { getSupabaseUrl } from '@/lib/supabase/url';

function getAdminClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 관리자 환경 변수가 없습니다.');
  return createClient(url, key);
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 10_000) {
    return Response.json({ error: '요청 본문이 너무 큽니다.' }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 10_000) {
    return Response.json({ error: '요청 본문이 너무 큽니다.' }, { status: 413 });
  }

  const body = parseBalanceImportPayload(rawBody, request.headers.get('content-type'));
  if (!body) return Response.json({ error: '유효한 요청 본문이 필요합니다.' }, { status: 400 });

  const authToken = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const token = typeof body.token === 'string' ? body.token : authToken;
  if (!token || token.length > 200) {
    return Response.json({ error: '유효한 연동 토큰이 필요합니다.' }, { status: 401 });
  }

  const directBalance = normalizeBalance(body.balance);
  const message = typeof body.message === 'string' ? body.message.slice(0, 2_000) : '';
  const balance = directBalance ?? parseBalanceFromMessage(message);
  if (balance === null) {
    return Response.json(
      { error: '문자에서 잔액을 찾지 못했습니다. “잔액” 또는 “출금가능금액”이 포함되어야 합니다.' },
      { status: 422 },
    );
  }

  const tokenHash = createHash('sha256').update(token).digest('hex');
  const supabase = getAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('balance_import_token_hash', tokenHash)
    .maybeSingle();

  if (profileError) {
    console.error('잔액 연동 프로필 조회 오류:', profileError);
    return Response.json({ error: '잔액 연동을 확인하지 못했습니다.' }, { status: 500 });
  }
  if (!profile) {
    return Response.json({ error: '유효하지 않은 연동 토큰입니다.' }, { status: 401 });
  }

  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({
      current_balance: balance,
      balance_updated_at: updatedAt,
      balance_source: 'iphone_messages',
      updated_at: updatedAt,
    })
    .eq('id', profile.id);

  if (error) {
    console.error('현재 잔액 저장 오류:', error);
    return Response.json({ error: '현재 잔액을 저장하지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ success: true, balance, updated_at: updatedAt });
}
