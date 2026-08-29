'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getKstToday } from '@/lib/schedule';
import { createClient } from '@/lib/supabase/client';
import { getSafeHttpUrl } from '@/lib/url';
import type { Subscription } from '@/types/subscription';

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const currentMonth = getKstToday().slice(0, 7);

  const fetchSubscription = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError) setError('지출 상세 정보를 불러오지 못했습니다.');
    setSubscription((data as Subscription | null) ?? null);
    setLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  async function toggleUsage() {
    if (!subscription) return;
    setSaving(true);
    setError('');
    const value = subscription.last_used_month === currentMonth ? null : currentMonth;
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ last_used_month: value, updated_at: new Date().toISOString() })
      .eq('id', subscription.id);

    if (updateError) setError('사용 상태를 변경하지 못했습니다.');
    else setSubscription({ ...subscription, last_used_month: value });
    setSaving(false);
  }

  async function handleDelete() {
    if (!subscription || !window.confirm('이 지출 일정을 삭제하시겠습니까?')) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from('subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', subscription.id);

    if (deleteError) {
      setError('지출 일정을 삭제하지 못했습니다.');
      setSaving(false);
      return;
    }
    router.replace('/');
  }

  if (loading) {
    return <main className="app-shell flex min-h-screen items-center justify-center">불러오는 중…</main>;
  }

  if (!subscription) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">지출 일정을 찾을 수 없습니다</h1>
          <Link href="/" className="mt-4 inline-block text-sm font-medium text-blue-600">캘린더로 돌아가기</Link>
        </div>
      </main>
    );
  }

  const isUsed = subscription.last_used_month === currentMonth;
  const safeCancelUrl = getSafeHttpUrl(subscription.cancel_url);

  return (
    <main className="app-shell min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="back-link">← 캘린더</Link>
          <Link href={`/subscriptions/form?id=${subscription.id}`} className="secondary-button">수정</Link>
        </div>

        <article className="detail-card">
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-7">
            <div>
              <p className="eyebrow">EXPENDITURE DETAIL</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                {subscription.name}
              </h1>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {subscription.billing_cycle === 'annual' ? '매년' : '매월'}
            </span>
          </div>

          {error && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

          <dl className="divide-y divide-slate-100 py-3">
            <div className="detail-row">
              <dt>결제 금액</dt>
              <dd className="text-xl font-semibold">{subscription.price.toLocaleString('ko-KR')}원</dd>
            </div>
            {subscription.description && (
              <div className="detail-row">
                <dt>내용</dt>
                <dd className="max-w-[65%] text-right whitespace-pre-wrap">{subscription.description}</dd>
              </div>
            )}
            <div className="detail-row">
              <dt>결제 일정</dt>
              <dd>
                {subscription.billing_cycle === 'annual'
                  ? `매년 ${subscription.billing_month}월 ${subscription.billing_day}일`
                  : `매월 ${subscription.billing_day}일`}
              </dd>
            </div>
            {subscription.expires_at && (
              <div className="detail-row">
                <dt>구독 만료일</dt>
                <dd>{subscription.expires_at}</dd>
              </div>
            )}
            <div className="detail-row">
              <dt>이번 달 사용</dt>
              <dd className={isUsed ? 'text-emerald-600' : 'text-rose-600'}>{isUsed ? '사용함' : '사용 안 함'}</dd>
            </div>
          </dl>

          <button className="primary-button w-full" disabled={saving} onClick={toggleUsage}>
            {saving ? '변경 중…' : isUsed ? '이번 달 미사용으로 변경' : '이번 달 사용으로 표시'}
          </button>

          {safeCancelUrl && (
            <a
              className="secondary-button mt-3 flex w-full justify-center"
              href={safeCancelUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              해지 페이지 열기 ↗
            </a>
          )}

          <button className="danger-button mt-8 w-full" disabled={saving} onClick={handleDelete}>
            일정 삭제
          </button>
        </article>
      </div>
    </main>
  );
}
