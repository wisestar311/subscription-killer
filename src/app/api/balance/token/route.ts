import { createHash, randomBytes } from 'node:crypto';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    balance_import_token_hash: tokenHash,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    return Response.json({ error: '연동 토큰을 저장하지 못했습니다.' }, { status: 500 });
  }

  return Response.json(
    { token },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { error } = await supabase
    .from('profiles')
    .update({ balance_import_token_hash: null, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    return Response.json({ error: '연동을 해제하지 못했습니다.' }, { status: 500 });
  }

  return Response.json({ success: true });
}
