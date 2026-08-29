'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getSafeHttpUrl } from '@/lib/url';

function SubscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const supabase = useMemo(() => createClient(), []);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [billingMonth, setBillingMonth] = useState('1');
  const [billingDay, setBillingDay] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [cancelUrl, setCancelUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(Boolean(id));
  const [error, setError] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    const { data, error: fetchError } = await supabase
      .from('subscriptions')
      .select('name, price, billing_cycle, billing_month, billing_day, expires_at, cancel_url')
      .eq('id', id)
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError || !data) {
      setError('수정할 지출 일정을 찾지 못했습니다.');
    } else {
      setName(data.name);
      setPrice(String(data.price));
      setBillingCycle(data.billing_cycle === 'annual' ? 'annual' : 'monthly');
      setBillingMonth(String(data.billing_month || 1));
      setBillingDay(String(data.billing_day));
      setExpiresAt(data.expires_at || '');
      setCancelUrl(data.cancel_url || '');
    }
    setInitialLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    const numericPrice = Number(price);
    const numericBillingDay = Number(billingDay);
    const numericBillingMonth = Number(billingMonth);
    if (!name.trim()) {
      setError('서비스명을 입력해주세요.');
      setLoading(false);
      return;
    }
    if (!Number.isSafeInteger(numericPrice) || numericPrice <= 0) {
      setError('금액은 1원 이상의 정수로 입력해주세요.');
      setLoading(false);
      return;
    }
    if (!Number.isInteger(numericBillingDay) || numericBillingDay < 1 || numericBillingDay > 31) {
      setError('결제일은 1일부터 31일 사이여야 합니다.');
      setLoading(false);
      return;
    }
    if (
      billingCycle === 'annual' &&
      (!Number.isInteger(numericBillingMonth) || numericBillingMonth < 1 || numericBillingMonth > 12)
    ) {
      setError('연간 결제 월을 선택해주세요.');
      setLoading(false);
      return;
    }

    const safeCancelUrl = cancelUrl.trim() ? getSafeHttpUrl(cancelUrl) : null;
    if (cancelUrl.trim() && !safeCancelUrl) {
      setError('해지 링크는 http:// 또는 https:// 주소로 입력해주세요.');
      setLoading(false);
      return;
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      setLoading(false);
      router.replace('/login');
      return;
    }

    const payload = {
      name: name.trim(),
      price: numericPrice,
      billing_cycle: billingCycle,
      billing_month: billingCycle === 'annual' ? numericBillingMonth : null,
      billing_day: numericBillingDay,
      expires_at: expiresAt || null,
      cancel_url: safeCancelUrl,
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    const result = id
      ? await supabase
          .from('subscriptions')
          .update(payload)
          .eq('id', id)
          .eq('user_id', user.id)
          .select('id')
          .single()
      : await supabase.from('subscriptions').insert(payload).select('id').single();

    if (result.error) {
      setError(`저장하지 못했습니다: ${result.error.message}`);
      setLoading(false);
      return;
    }

    router.replace(`/subscriptions/${result.data.id}`);
  }

  if (initialLoading) {
    return <div className="py-20 text-center text-sm text-slate-500">일정을 불러오는 중…</div>;
  }

  return (
    <main className="app-shell min-h-screen px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <Link href={id ? `/subscriptions/${id}` : '/'} className="back-link">
          ← {id ? '상세' : '캘린더'}
        </Link>

        <div className="form-card mt-6">
          <p className="eyebrow">EXPENDITURE SCHEDULE</p>
          <h1 className="mb-7 mt-2 text-2xl font-semibold tracking-tight">
            {id ? '지출 일정 수정' : '지출 일정 추가'}
          </h1>

          {error && <p className="mb-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className="field-label">서비스명</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="예: 넷플릭스"
                maxLength={80}
                required
                className="field-input"
              />
            </div>

            <div>
              <label htmlFor="price" className="field-label">금액</label>
              <div className="relative">
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(event) => setPrice(event.target.value)}
                  placeholder="17000"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  required
                  className="field-input pr-12"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">원</span>
              </div>
            </div>

            <div>
              <label htmlFor="billing-cycle" className="field-label">결제 주기</label>
              <select
                id="billing-cycle"
                value={billingCycle}
                onChange={(event) => setBillingCycle(event.target.value as 'monthly' | 'annual')}
                className="field-input"
              >
                <option value="monthly">매월</option>
                <option value="annual">매년</option>
              </select>
            </div>

            {billingCycle === 'annual' && (
              <div>
                <label htmlFor="billing-month" className="field-label">결제 월</label>
                <select
                  id="billing-month"
                  value={billingMonth}
                  onChange={(event) => setBillingMonth(event.target.value)}
                  className="field-input"
                >
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                    <option key={month} value={month}>{month}월</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="billing-day" className="field-label">
                {billingCycle === 'annual' ? '결제일' : '매월 결제일'}
              </label>
              <select
                id="billing-day"
                value={billingDay}
                onChange={(event) => setBillingDay(event.target.value)}
                className="field-input"
              >
                {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                  <option key={day} value={day}>
                    {billingCycle === 'annual' ? `${billingMonth}월 ${day}일` : `${day}일`}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                해당 날짜가 없는 달에는 말일로 자동 조정됩니다.
              </p>
            </div>

            <div>
              <label htmlFor="expires-at" className="field-label">
                구독 만료일 <span className="font-normal text-slate-400">선택</span>
              </label>
              <input
                id="expires-at"
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                className="field-input"
              />
            </div>

            <div>
              <label htmlFor="cancel-url" className="field-label">
                해지 링크 <span className="font-normal text-slate-400">선택</span>
              </label>
              <input
                id="cancel-url"
                type="url"
                value={cancelUrl}
                onChange={(event) => setCancelUrl(event.target.value)}
                placeholder="https://..."
                className="field-input"
              />
            </div>

            <button type="submit" disabled={loading} className="primary-button mt-3 w-full">
              {loading ? '저장 중…' : '일정 저장'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

export default function SubscriptionFormPage() {
  return (
    <Suspense fallback={<div className="app-shell min-h-screen p-12 text-center">불러오는 중…</div>}>
      <SubscriptionForm />
    </Suspense>
  );
}
