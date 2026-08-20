'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Subscription } from '@/types/subscription';

export default function HomePage() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [thisMonthTotal, setThisMonthTotal] = useState(0);
  const [nextMonthTotal, setNextMonthTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'unused'>('all');
  const [loading, setLoading] = useState(true);

  const supabase = createClient();
  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('billing_day');

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const list = data || [];
    setSubscriptions(list);
    const total = list.reduce((sum, s) => sum + s.price, 0);
    setThisMonthTotal(total);
    setNextMonthTotal(total);
    setLoading(false);
  };

  const toggleUsage = async (id: string, used: boolean) => {
    const value = used ? currentMonth : null;
    const { error } = await supabase
      .from('subscriptions')
      .update({ last_used_month: value })
      .eq('id', id);

    if (!error) {
      setSubscriptions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, last_used_month: value } : s))
      );
    }
  };

  const filteredList =
    filter === 'unused'
      ? subscriptions.filter((s) => s.last_used_month !== currentMonth)
      : subscriptions;

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-lg mx-auto pb-24">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">구독 킬러</h1>
        <Link href="/settings" className="text-sm text-gray-500 underline">
          설정
        </Link>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-sm mb-5">
        <p className="text-sm text-gray-500">이번 달 결제 총액</p>
        <p className="text-3xl font-bold mt-1">
          {thisMonthTotal.toLocaleString()}
          <span className="text-lg font-medium ml-1">원</span>
        </p>
        <p className="text-sm text-gray-500 mt-2">
          다음 달 예상 · {nextMonthTotal.toLocaleString()}원
        </p>
      </div>

      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            filter === 'all' ? 'bg-black text-white' : 'bg-white text-gray-600'
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setFilter('unused')}
          className={`px-4 py-2 rounded-full text-sm font-medium ${
            filter === 'unused' ? 'bg-black text-white' : 'bg-white text-gray-600'
          }`}
        >
          미사용만
        </button>
      </div>

      <div className="space-y-3">
        {filteredList.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {filter === 'unused' ? '미사용 구독이 없습니다' : '등록된 구독이 없습니다'}
          </div>
        ) : (
          filteredList.map((sub) => {
            const isUsed = sub.last_used_month === currentMonth;
            return (
              <div key={sub.id} className="bg-white rounded-2xl p-4 shadow-sm">
                <Link href={`/subscriptions/form?id=${sub.id}`} className="block">
                  <div>
                    <h3 className="font-semibold">{sub.name}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      매월 {sub.billing_day}일 · {sub.price.toLocaleString()}원
                    </p>
                  </div>
                </Link>

                <div className="flex justify-between items-center mt-3">
                  <button
                    onClick={() => toggleUsage(sub.id, !isUsed)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                      isUsed
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {isUsed ? '사용함' : '안 씀'}
                  </button>

                  {sub.cancel_url && (
                    <a
                      href={sub.cancel_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600"
                    >
                      해지하기 →
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Link href="/subscriptions/form">
        <button className="fixed bottom-6 right-6 bg-black text-white w-14 h-14 rounded-full text-2xl shadow-lg flex items-center justify-center">
          +
        </button>
      </Link>
    </div>
  );
}
