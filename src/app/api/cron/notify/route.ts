import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email';
import { sendTelegramMessage } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + 2);
  const targetDay = targetDate.getDate();
  const currentMonth = today.toISOString().slice(0, 7);

  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('id, name, price, billing_day, cancel_url, last_used_month, user_id')
    .eq('is_active', true)
    .eq('billing_day', targetDay);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const targets = (subscriptions || []).filter(
    (s) => s.last_used_month !== currentMonth
  );

  if (targets.length === 0) {
    return NextResponse.json({ success: true, sent: 0 });
  }

  const userMap = new Map<string, typeof targets>();
  for (const sub of targets) {
    if (!userMap.has(sub.user_id)) {
      userMap.set(sub.user_id, []);
    }
    userMap.get(sub.user_id)!.push(sub);
  }

  let sentCount = 0;

  for (const [userId, subs] of Array.from(userMap.entries())) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;

      const { data: profile } = await supabase
        .from('profiles')
        .select('telegram_chat_id')
        .eq('id', userId)
        .single();

      const telegramChatId = profile?.telegram_chat_id;

      if (!email && !telegramChatId) continue;

      const lines = subs.map((s) => {
        let line = `• ${s.name} (${s.price.toLocaleString()}원) - ${s.billing_day}일 결제`;
        if (s.cancel_url) line += `\n  해지: ${s.cancel_url}`;
        return line;
      });

      const message = `[구독 킬러] 결제 2일 전 알림\n\n${lines.join(
        '\n\n'
      )}\n\n이번 달 사용하지 않았다면 해지하세요.`;

      if (email) {
        await sendEmail({
          to: email,
          subject: `[구독 킬러] 결제 2일 전 알림 (${subs.length}건)`,
          text: message,
        });
      }

      if (telegramChatId) {
        await sendTelegramMessage(telegramChatId, message);
      }

      sentCount++;
    } catch (err) {
      console.error(err);
    }
  }

  return NextResponse.json({ success: true, sent: sentCount });
}
