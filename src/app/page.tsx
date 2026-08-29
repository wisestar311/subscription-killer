'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  getCalendarCells,
  getKstToday,
  getMonthKey,
  getScheduledDate,
  getScheduledDay,
  moveMonth,
  parseIsoDate,
} from '@/lib/schedule';
import type { Profile, Subscription } from '@/types/subscription';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function formatWon(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatBilling(subscription: Subscription) {
  return subscription.billing_cycle === 'annual'
    ? `매년 ${subscription.billing_month ?? '?'}월 ${subscription.billing_day}일`
    : `매월 ${subscription.billing_day}일`;
}

export default function HomePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const today = useMemo(() => getKstToday(), []);
  const todayParts = useMemo(() => parseIsoDate(today), [today]);
  const [view, setView] = useState({
    year: todayParts.year,
    monthIndex: todayParts.monthIndex,
  });
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      router.replace('/login');
      return;
    }

    const [subscriptionsResult, profileResult] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('id, user_id, name, price, expense_type, billing_day, billing_cycle, billing_month, expires_at, cancel_url, is_active, last_used_month, created_at, updated_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('billing_day'),
      supabase
        .from('profiles')
        .select('id, telegram_chat_id, current_balance, balance_updated_at, balance_source')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    if (subscriptionsResult.error) {
      setError('지출 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    } else {
      setSubscriptions((subscriptionsResult.data || []) as Subscription[]);
    }

    if (!profileResult.error) setProfile(profileResult.data as Profile | null);
    setLoading(false);
  }, [router, supabase]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const calendarCells = useMemo(
    () => getCalendarCells(view.year, view.monthIndex),
    [view],
  );
  const monthKey = getMonthKey(view.year, view.monthIndex);
  const scheduledSubscriptions = useMemo(
    () =>
      subscriptions.filter((subscription) => {
        if (
          subscription.billing_cycle === 'annual' &&
          subscription.billing_month !== view.monthIndex + 1
        ) {
          return false;
        }

        const scheduledDate = getScheduledDate(
          view.year,
          view.monthIndex,
          subscription.billing_day,
        );
        return !subscription.expires_at || subscription.expires_at.slice(0, 10) >= scheduledDate;
      }),
    [subscriptions, view],
  );
  const minimumExpenditure = scheduledSubscriptions.reduce(
    (total, subscription) => total + subscription.price,
    0,
  );
  const subscriptionTotal = scheduledSubscriptions
    .filter((subscription) => subscription.expense_type !== 'fixed')
    .reduce((total, subscription) => total + subscription.price, 0);
  const fixedTotal = scheduledSubscriptions
    .filter((subscription) => subscription.expense_type === 'fixed')
    .reduce((total, subscription) => total + subscription.price, 0);
  const currentBalance = profile?.current_balance ?? null;
  const availableAfterSchedule =
    currentBalance === null ? null : currentBalance - minimumExpenditure;

  const entriesByDay = useMemo(() => {
    const result = new Map<number, Subscription[]>();
    for (const subscription of scheduledSubscriptions) {
      const day = getScheduledDay(view.year, view.monthIndex, subscription.billing_day);
      result.set(day, [...(result.get(day) ?? []), subscription]);
    }
    return result;
  }, [scheduledSubscriptions, view]);
  const dailyTotals = useMemo(() => {
    const result = new Map<number, number>();
    for (const [day, entries] of entriesByDay) {
      result.set(day, entries.reduce((total, entry) => total + entry.price, 0));
    }
    return result;
  }, [entriesByDay]);
  const balanceByDay = useMemo(() => {
    const result = new Map<number, number | null>();
    let scheduledBefore = 0;
    const daysInMonth = new Date(view.year, view.monthIndex + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day += 1) {
      scheduledBefore += dailyTotals.get(day) ?? 0;
      result.set(day, currentBalance === null ? null : currentBalance - scheduledBefore);
    }
    return result;
  }, [currentBalance, dailyTotals, view]);

  function changeMonth(amount: number) {
    setView((current) => moveMonth(current.year, current.monthIndex, amount));
  }

  if (loading) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center">
        <div className="loading-pulse">지출 일정을 정리하고 있어요</div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen pb-28">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <p className="eyebrow">EXPENDITURE CONTROL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              지출 캘린더
            </h1>
          </div>
          <Link className="icon-link" href="/settings" aria-label="설정 열기">
            설정
          </Link>
        </header>

        {error && (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {error}
          </div>
        )}

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <article className="summary-card summary-card-dark md:col-span-1">
            <p className="summary-label text-white/60">
              {view.monthIndex + 1}월 예상 구독료
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatWon(subscriptionTotal)}
            </p>
            <p className="mt-5 text-xs text-white/50">
              구독 {scheduledSubscriptions.filter((entry) => entry.expense_type !== 'fixed').length}건
            </p>
          </article>

          <article className="summary-card border-amber-100 bg-amber-50/60">
            <p className="summary-label text-amber-700">{view.monthIndex + 1}월 고정지출</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-amber-950">{formatWon(fixedTotal)}</p>
            <p className="mt-5 text-xs text-amber-700/70">고정지출 {scheduledSubscriptions.filter((entry) => entry.expense_type === 'fixed').length}건</p>
          </article>

          <article className="summary-card border-blue-100 bg-blue-50/60">
            <p className="summary-label text-blue-700">{view.monthIndex + 1}월 전체 예정지출</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-blue-950">{formatWon(minimumExpenditure)}</p>
            <p className="mt-5 text-xs text-blue-700/70">최소 필요 지출 합계</p>
          </article>

          <article className="summary-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="summary-label">현재 잔액</p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {currentBalance === null ? '연동 필요' : formatWon(currentBalance)}
                </p>
              </div>
              <span className={`status-dot ${currentBalance === null ? 'status-dot-muted' : ''}`} />
            </div>
            <p className="mt-5 text-xs text-slate-400">
              {profile?.balance_updated_at
                ? `${new Date(profile.balance_updated_at).toLocaleString('ko-KR')} 업데이트`
                : 'iPhone 메시지 자동화를 설정에서 연결하세요'}
            </p>
          </article>

          <article className="summary-card">
            <p className="summary-label">예정 지출 후 잔액</p>
            <p
              className={`mt-3 text-3xl font-semibold tracking-tight ${
                availableAfterSchedule !== null && availableAfterSchedule < 0
                  ? 'text-rose-600'
                  : 'text-slate-950'
              }`}
            >
              {availableAfterSchedule === null ? '—' : formatWon(availableAfterSchedule)}
            </p>
            <p className="mt-5 text-xs text-slate-400">
              {availableAfterSchedule !== null && availableAfterSchedule < 0
                ? `${formatWon(Math.abs(availableAfterSchedule))} 부족합니다`
                : '현재 잔액에서 최소 필요 지출을 제외한 금액'}
            </p>
          </article>
        </section>

        <section
          className="calendar-panel"
          aria-label={`${view.year}년 ${view.monthIndex + 1}월 지출 일정`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-2">
              <button className="month-button" onClick={() => changeMonth(-1)} aria-label="이전 달">
                ←
              </button>
              <h2 className="min-w-32 text-center text-lg font-semibold text-slate-950">
                {view.year}. {String(view.monthIndex + 1).padStart(2, '0')}
              </h2>
              <button className="month-button" onClick={() => changeMonth(1)} aria-label="다음 달">
                →
              </button>
            </div>
            <button
              className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              onClick={() =>
                setView({ year: todayParts.year, monthIndex: todayParts.monthIndex })
              }
            >
              이번 달
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3 text-[11px] font-medium text-slate-500 sm:px-6">
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-500" />구독</span>
            <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-amber-500" />고정지출</span>
            <span>각 날짜: 지출 합계 · 예정 잔고</span>
          </div>

          <div className="calendar-grid border-b border-slate-200 bg-slate-50/70">
            {WEEKDAYS.map((weekday, index) => (
              <div
                key={weekday}
                className={`py-2 text-center text-[11px] font-semibold ${
                  index === 0
                    ? 'text-rose-500'
                    : index === 6
                      ? 'text-blue-500'
                      : 'text-slate-400'
                }`}
              >
                {weekday}
              </div>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarCells.map((day, index) => {
              const dayEntries = day ? entriesByDay.get(day) ?? [] : [];
              const isToday =
                day !== null && `${monthKey}-${String(day).padStart(2, '0')}` === today;
              return (
                <div
                  key={`${index}-${day ?? 'empty'}`}
                  className={`calendar-cell ${day === null ? 'calendar-cell-empty' : ''}`}
                >
                  {day !== null && (
                    <>
                      <div className={`calendar-day ${isToday ? 'calendar-day-today' : ''}`}>
                        {day}
                      </div>
                      <div className="mt-1 space-y-0.5 text-[10px] font-semibold text-slate-500">
                        <div>지출 {formatWon(dailyTotals.get(day) ?? 0)}</div>
                        <div className={balanceByDay.get(day) !== null && (balanceByDay.get(day) ?? 0) < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                          잔고 {balanceByDay.get(day) === null ? '—' : formatWon(balanceByDay.get(day) ?? 0)}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1.5">
                        {dayEntries.map((entry) => (
                          <Link
                            key={entry.id}
                            href={`/subscriptions/${entry.id}`}
                            className={`calendar-entry ${entry.expense_type === 'fixed' ? 'calendar-entry-fixed' : ''}`}
                            title={`${entry.name} · ${formatBilling(entry)} · ${formatWon(entry.price)}${
                              entry.expires_at ? ` · ${entry.expires_at} 만료` : ''
                            }`}
                          >
                            <span className="calendar-entry-name">
                              {entry.name}{entry.billing_cycle === 'annual' ? ' · 연' : ''}
                            </span>
                            <span className="calendar-entry-price">{formatWon(entry.price)}</span>
                          </Link>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Link href="/subscriptions/form" className="floating-add">
        <span aria-hidden="true">＋</span>
        <span>지출 추가</span>
      </Link>
    </main>
  );
}
