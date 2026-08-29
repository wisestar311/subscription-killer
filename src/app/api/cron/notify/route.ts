import { createClient } from '@supabase/supabase-js';
import { sendEmail, type DeliveryResult } from '@/lib/email';
import {
  addDays,
  getDaysInMonth,
  getKstToday,
  getScheduledDate,
  parseIsoDate,
} from '@/lib/schedule';
import { sendTelegramMessage } from '@/lib/telegram';

type NotificationChannel = 'email' | 'telegram';

type NotificationSubscription = {
  id: string;
  name: string;
  price: number;
  billing_day: number;
  billing_cycle: 'monthly' | 'annual';
  billing_month: number | null;
  expires_at: string | null;
  cancel_url: string | null;
  last_used_month: string | null;
  user_id: string;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase 관리자 환경 변수가 없습니다.');
  return createClient(url, key);
}

function buildMessage(subscriptions: NotificationSubscription[], billingDate: string) {
  const lines = subscriptions.map((subscription) => {
    const schedule =
      subscription.billing_cycle === 'annual'
        ? `매년 ${subscription.billing_month}월 ${subscription.billing_day}일`
        : `매월 ${subscription.billing_day}일`;
    let line = `• ${subscription.name} (${subscription.price.toLocaleString('ko-KR')}원) · ${schedule}`;
    if (subscription.expires_at) line += `\n  만료: ${subscription.expires_at}`;
    if (subscription.cancel_url) line += `\n  해지: ${subscription.cancel_url}`;
    return line;
  });

  return `[구독 킬러] ${billingDate} 결제 예정\n\n${lines.join(
    '\n\n',
  )}\n\n최근 사용하지 않았다면 결제 전에 해지를 검토하세요.`;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let supabase: ReturnType<typeof getAdminClient>;
  try {
    supabase = getAdminClient();
  } catch (error) {
    console.error(error);
    return Response.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const today = getKstToday();
  const billingDate = addDays(today, 2);
  const { year, monthIndex, day: targetDay } = parseIsoDate(billingDate);
  const usageMonth = today.slice(0, 7);

  let subscriptionsQuery = supabase
    .from('subscriptions')
    .select(
      'id, name, price, billing_day, billing_cycle, billing_month, expires_at, cancel_url, last_used_month, user_id',
    )
    .eq('is_active', true);

  subscriptionsQuery =
    targetDay === getDaysInMonth(year, monthIndex)
      ? subscriptionsQuery.gte('billing_day', targetDay)
      : subscriptionsQuery.eq('billing_day', targetDay);

  const { data, error } = await subscriptionsQuery;
  if (error) {
    console.error('알림 대상 조회 오류:', error);
    return Response.json({ error: 'Failed to load subscriptions' }, { status: 500 });
  }

  const targets = ((data || []) as NotificationSubscription[]).filter((subscription) => {
    if (getScheduledDate(year, monthIndex, subscription.billing_day) !== billingDate) return false;
    if (subscription.last_used_month === usageMonth) return false;
    if (subscription.expires_at && subscription.expires_at.slice(0, 10) < billingDate) return false;
    if (subscription.billing_cycle === 'annual') {
      return subscription.billing_month === monthIndex + 1;
    }
    return true;
  });

  const userMap = new Map<string, NotificationSubscription[]>();
  for (const subscription of targets) {
    const userSubscriptions = userMap.get(subscription.user_id) ?? [];
    userSubscriptions.push(subscription);
    userMap.set(subscription.user_id, userSubscriptions);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  async function claim(
    subscriptions: NotificationSubscription[],
    channel: NotificationChannel,
  ) {
    const claimed: NotificationSubscription[] = [];
    for (const subscription of subscriptions) {
      const { data: didClaim, error: claimError } = await supabase.rpc(
        'claim_notification_delivery',
        {
          p_subscription_id: subscription.id,
          p_user_id: subscription.user_id,
          p_billing_date: billingDate,
          p_channel: channel,
        },
      );

      if (claimError) {
        console.error('알림 발송 선점 오류:', claimError);
        failed += 1;
      } else if (didClaim) {
        claimed.push(subscription);
      } else {
        skipped += 1;
      }
    }
    return claimed;
  }

  async function finish(
    subscriptions: NotificationSubscription[],
    channel: NotificationChannel,
    result: DeliveryResult,
  ) {
    if (subscriptions.length === 0) return;
    const values = result.ok
      ? {
          status: 'sent',
          provider_id: result.providerId ?? null,
          error: null,
          sent_at: new Date().toISOString(),
        }
      : { status: 'failed', provider_id: null, error: result.error, sent_at: null };

    const { error: updateError } = await supabase
      .from('notification_deliveries')
      .update(values)
      .in(
        'subscription_id',
        subscriptions.map((subscription) => subscription.id),
      )
      .eq('billing_date', billingDate)
      .eq('channel', channel);

    if (updateError) console.error('알림 발송 결과 저장 오류:', updateError);
    if (result.ok) sent += 1;
    else failed += 1;
  }

  for (const [userId, subscriptions] of Array.from(userMap.entries())) {
    const [{ data: userData, error: userError }, { data: profile, error: profileError }] =
      await Promise.all([
        supabase.auth.admin.getUserById(userId),
        supabase.from('profiles').select('telegram_chat_id').eq('id', userId).maybeSingle(),
      ]);

    if (userError) console.error('알림 사용자 조회 오류:', userError);
    if (profileError) console.error('알림 프로필 조회 오류:', profileError);

    const email = userData?.user?.email;
    const telegramChatId = profile?.telegram_chat_id;

    if (email) {
      const emailTargets = await claim(subscriptions, 'email');
      if (emailTargets.length > 0) {
        const result = await sendEmail({
          to: email,
          subject: `[구독 킬러] ${billingDate} 결제 예정 (${emailTargets.length}건)`,
          text: buildMessage(emailTargets, billingDate),
          idempotencyKey: `subscription-killer:${userId}:${billingDate}:email`,
        });
        await finish(emailTargets, 'email', result);
      }
    }

    if (telegramChatId) {
      const telegramTargets = await claim(subscriptions, 'telegram');
      if (telegramTargets.length > 0) {
        const result = await sendTelegramMessage(
          telegramChatId,
          buildMessage(telegramTargets, billingDate),
        );
        await finish(telegramTargets, 'telegram', result);
      }
    }
  }

  const status = failed > 0 ? 207 : 200;
  return Response.json(
    { success: failed === 0, billing_date: billingDate, sent, failed, skipped },
    { status },
  );
}
