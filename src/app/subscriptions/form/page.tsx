'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function SubscriptionForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [billingMonth, setBillingMonth] = useState('8');
  const [billingDay, setBillingDay] = useState('1');
  const [expiresAt, setExpiresAt] = useState('');
  const [cancelUrl, setCancelUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('id', id)
        .single();

      if (data) {
        setName(data.name);
        setPrice(String(data.price));
        setBillingCycle(data.billing_cycle === 'annual' ? 'annual' : 'monthly');
        setBillingMonth(String(data.billing_month || 8));
        setBillingDay(String(data.billing_day));
        setExpiresAt(data.expires_at || '');
        setCancelUrl(data.cancel_url || '');
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      name,
      price: Number(price),
      billing_cycle: billingCycle,
      billing_month: billingCycle === 'annual' ? Number(billingMonth) : null,
      billing_day: Number(billingDay),
      expires_at: expiresAt || null,
      cancel_url: cancelUrl || null,
      user_id: user.id,
    };

    if (id) {
      await supabase.from('subscriptions').update(payload).eq('id', id);
    } else {
      await supabase.from('subscriptions').insert(payload);
    }

    setLoading(false);
    router.push('/');
  };

  const handleDelete = async () => {
    if (!id || !confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('subscriptions').update({ is_active: false }).eq('id', id);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">{id ? '구독 수정' : '구독 추가'}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">서비스명</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: 넷플릭스"
            required
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">금액 (원)</label>
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="17000"
            required
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">결제 주기</label>
          <select
            value={billingCycle}
            onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
            className="w-full border rounded-lg px-3 py-2"
          >
            <option value="monthly">매월</option>
            <option value="annual">매년 (연정액)</option>
          </select>
        </div>

        {billingCycle === 'annual' && (
          <div>
            <label className="block text-sm font-medium mb-1">결제 월</label>
            <select
              value={billingMonth}
              onChange={(e) => setBillingMonth(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}월
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">결제일</label>
          <select
            value={billingDay}
            onChange={(e) => setBillingDay(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {billingCycle === 'annual' ? `매년 ${billingMonth}월 ${day}일` : `매월 ${day}일`}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">구독 만료일 (선택)</label>
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="w-full border rounded-lg px-3 py-2"
          />
          <p className="text-xs text-gray-500 mt-1">비워두면 만료일 없음</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">해지 링크 (선택)</label>
          <input
            type="url"
            value={cancelUrl}
            onChange={(e) => setCancelUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <div className="pt-4 space-y-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 rounded-lg font-medium"
          >
            {loading ? '저장 중...' : '저장하기'}
          </button>

          {id && (
            <button
              type="button"
              onClick={handleDelete}
              className="w-full bg-red-100 text-red-600 py-3 rounded-lg font-medium"
            >
              삭제하기
            </button>
          )}

          <button
            type="button"
            onClick={() => router.back()}
            className="w-full bg-gray-100 py-3 rounded-lg"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}

export default function SubscriptionFormPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">로딩 중...</div>}>
      <SubscriptionForm />
    </Suspense>
  );
}
