'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
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
type ViewMode = 'calendar' | 'spreadsheet';
type SpreadsheetRow = {
  entry: Subscription;
  day: number;
  scheduledDate: string;
  projectedBalance: number | null;
};

type SpreadsheetGroup = {
  scheduledDate: string;
  projectedBalance: number | null;
  total: number;
  rows: SpreadsheetRow[];
};

type SpreadsheetSection = {
  expenseType: Subscription['expense_type'];
  label: string;
  total: number;
  count: number;
  groups: SpreadsheetGroup[];
};

const EXPENSE_SECTIONS: Array<Pick<SpreadsheetSection, 'expenseType' | 'label'>> = [
  { expenseType: 'subscription', label: '구독' },
  { expenseType: 'fixed', label: '고정지출' },
];

function groupSpreadsheetRows(rows: SpreadsheetRow[]) {
  const groups: SpreadsheetGroup[] = [];

  for (const row of rows) {
    const currentGroup = groups.at(-1);
    if (!currentGroup || currentGroup.scheduledDate !== row.scheduledDate) {
      groups.push({
        scheduledDate: row.scheduledDate,
        projectedBalance: row.projectedBalance,
        total: row.entry.price,
        rows: [row],
      });
      continue;
    }

    currentGroup.rows.push(row);
    currentGroup.total += row.entry.price;
  }

  return groups;
}

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
  const [userId, setUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
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
    setUserId(user.id);

    const [subscriptionsResult, profileResult] = await Promise.all([
      supabase
        .from('subscriptions')
      .select('id, user_id, name, description, price, expense_type, schedule_type, scheduled_date, billing_day, billing_cycle, billing_month, expires_at, cancel_url, is_active, last_used_month, created_at, updated_at')
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

  useEffect(() => {
    if (!userId) return;

    const syncBalance = async () => {
      const { data, error: balanceError } = await supabase
        .from('profiles')
        .select('id, telegram_chat_id, current_balance, balance_updated_at, balance_source')
        .eq('id', userId)
        .maybeSingle();

      if (!balanceError && data) setProfile(data as Profile);
    };

    const channel = supabase
      .channel(`profile-balance-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`,
        },
        (payload) => setProfile(payload.new as Profile),
      )
      .subscribe();
    const balancePoll = window.setInterval(() => void syncBalance(), 15_000);
    const syncOnFocus = () => void syncBalance();
    window.addEventListener('focus', syncOnFocus);

    return () => {
      window.clearInterval(balancePoll);
      window.removeEventListener('focus', syncOnFocus);
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  const calendarCells = useMemo(
    () => getCalendarCells(view.year, view.monthIndex),
    [view],
  );
  const monthKey = getMonthKey(view.year, view.monthIndex);
  const scheduledSubscriptions = useMemo(
    () =>
      subscriptions.filter((subscription) => {
        if (
          subscription.schedule_type === 'one_time'
        ) {
          return subscription.scheduled_date?.slice(0, 7) === getMonthKey(view.year, view.monthIndex);
        }
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

  const entriesByDay = useMemo(() => {
    const result = new Map<number, Subscription[]>();
    for (const subscription of scheduledSubscriptions) {
      const day = subscription.schedule_type === 'one_time' && subscription.scheduled_date
        ? Number(subscription.scheduled_date.slice(8, 10))
        : getScheduledDay(view.year, view.monthIndex, subscription.billing_day);
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
  const spreadsheetEntries = useMemo<SpreadsheetRow[]>(
    () =>
      scheduledSubscriptions
        .map((entry) => {
          const day = entry.schedule_type === 'one_time' && entry.scheduled_date
            ? Number(entry.scheduled_date.slice(8, 10))
            : getScheduledDay(view.year, view.monthIndex, entry.billing_day);

          return {
            entry,
            day,
            scheduledDate: `${monthKey}-${String(day).padStart(2, '0')}`,
            projectedBalance: balanceByDay.get(day) ?? null,
          };
        })
        .sort((a, b) => a.day - b.day || a.entry.name.localeCompare(b.entry.name, 'ko')),
    [balanceByDay, monthKey, scheduledSubscriptions, view],
  );
  const spreadsheetSections = useMemo<SpreadsheetSection[]>(
    () =>
      EXPENSE_SECTIONS.map(({ expenseType, label }) => {
        const rows = spreadsheetEntries.filter(
          ({ entry }) => entry.expense_type === expenseType,
        );

        return {
          expenseType,
          label,
          total: rows.reduce((total, { entry }) => total + entry.price, 0),
          count: rows.length,
          groups: groupSpreadsheetRows(rows),
        };
      }).filter(({ count }) => count > 0),
    [spreadsheetEntries],
  );
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
        <header className="top-nav mb-8 flex items-center justify-between">
          <div>
            <p className="eyebrow">EXPENDITURE CONTROL</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
              지출 일정
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

        <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <article className="summary-card summary-card-dark md:col-span-1">
            <p className="summary-label text-white/60">
              {view.monthIndex + 1}월 예상 구독
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">
              {formatWon(subscriptionTotal)}
            </p>
            <p className="mt-5 text-xs text-white/50">
              구독 {scheduledSubscriptions.filter((entry) => entry.expense_type !== 'fixed').length}건
            </p>
          </article>

          <article className="summary-card summary-card-fixed">
            <p className="summary-label">{view.monthIndex + 1}월 예상 고정지출</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{formatWon(fixedTotal)}</p>
            <p className="mt-5 text-xs">고정지출 {scheduledSubscriptions.filter((entry) => entry.expense_type === 'fixed').length}건</p>
          </article>

          <article className="summary-card summary-card-total">
            <p className="summary-label">{view.monthIndex + 1}월 전체 예정지출</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight">{formatWon(minimumExpenditure)}</p>
            <p className="mt-5 text-xs">최소 필요 지출 합계</p>
          </article>

        </section>

        <section
          className="calendar-panel"
          aria-label={`${view.year}년 ${view.monthIndex + 1}월 ${viewMode === 'calendar' ? '캘린더' : '스프레드시트'} 지출 일정`}
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-right shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">현재 잔액</p>
                <p className="mt-0.5 text-sm font-bold text-slate-950" aria-live="polite">
                  {currentBalance === null ? '연동 필요' : formatWon(currentBalance)}
                </p>
                <p className="text-[10px] text-slate-400">
                  {profile?.balance_updated_at ? '메시지 실시간 연동됨' : 'iPhone 메시지 연동 필요'}
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                onClick={() =>
                  setView({ year: todayParts.year, monthIndex: todayParts.monthIndex })
                }
              >
                이번 달
              </button>
              <div className="view-switcher" role="group" aria-label="보기 방식 선택">
                <button
                  type="button"
                  className={`view-switcher-button ${viewMode === 'calendar' ? 'view-switcher-button-active' : ''}`}
                  aria-pressed={viewMode === 'calendar'}
                  onClick={() => setViewMode('calendar')}
                >
                  캘린더
                </button>
                <button
                  type="button"
                  className={`view-switcher-button ${viewMode === 'spreadsheet' ? 'view-switcher-button-active' : ''}`}
                  aria-pressed={viewMode === 'spreadsheet'}
                  onClick={() => setViewMode('spreadsheet')}
                >
                  스프레드시트
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'calendar' ? (
            <>
              <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-4 py-3 text-[11px] font-medium text-slate-500 sm:px-6">
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" />고정지출</span>
                <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-orange-500" />구독</span>
                <span>각 날짜: 전체 지출 합계</span>
              </div>

              <div className="calendar-grid border-b border-slate-200 bg-slate-50/70">
                {WEEKDAYS.map((weekday, index) => (
                  <div
                    key={weekday}
                    className={`py-2 text-center text-xs font-bold ${
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
                          <div
                            className={`calendar-day ${
                              index % 7 === 0
                                ? 'calendar-day-sunday'
                                : index % 7 === 6
                                  ? 'calendar-day-saturday'
                                  : ''
                            } ${isToday ? 'calendar-day-today' : ''}`}
                          >
                            {day}
                          </div>
                          <div className="mt-1 space-y-0.5 text-[10px] font-semibold text-slate-500">
                            <div>지출 {formatWon(dailyTotals.get(day) ?? 0)}</div>
                            <div className="text-blue-600">
                              잔액 {balanceByDay.get(day) === null ? '—' : formatWon(balanceByDay.get(day) ?? 0)}
                            </div>
                          </div>
                          <Link href={`/subscriptions/form?date=${monthKey}-${String(day).padStart(2, '0')}`} className="mt-1 block text-sm font-bold leading-none text-slate-400 hover:text-slate-700" aria-label={`${day}일 지출 추가`}>
                            +
                          </Link>
                          <div className="mt-2 space-y-1.5">
                            {dayEntries.map((entry) => (
                              <Link
                                key={entry.id}
                                href={`/subscriptions/${entry.id}`}
                                className={`calendar-entry ${entry.expense_type === 'fixed' ? 'calendar-entry-fixed' : 'calendar-entry-subscription'}`}
                                title={`${entry.name} · ${formatBilling(entry)} · ${formatWon(entry.price)}${
                                  entry.description ? ` · ${entry.description}` : ''
                                }${
                                  entry.expires_at ? ` · ${entry.expires_at} 만료` : ''
                                }`}
                              >
                                <span className="calendar-entry-name">
                                  <span className="block">{entry.name}{entry.billing_cycle === 'annual' ? ' · 연' : ''}</span>
                                  {entry.description && <span className="calendar-entry-description">{entry.description}</span>}
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
            </>
          ) : (
            <div className="spreadsheet-wrap">
              <table className="spreadsheet-table">
                <caption className="sr-only">{view.year}년 {view.monthIndex + 1}월 지출 목록</caption>
                <thead>
                  <tr>
                    <th scope="col">날짜</th>
                    <th scope="col">구분</th>
                    <th scope="col">내역</th>
                    <th scope="col">내용</th>
                    <th scope="col">반복</th>
                    <th scope="col" className="spreadsheet-number">예정금액</th>
                    <th scope="col" className="spreadsheet-number">잔액</th>
                    <th scope="col"><span className="sr-only">상세</span></th>
                  </tr>
                </thead>
                {spreadsheetSections.length > 0 ? spreadsheetSections.map((section) => (
                  <Fragment key={section.expenseType}>
                    <tbody className={`spreadsheet-section-heading spreadsheet-section-heading-${section.expenseType}`}>
                      <tr>
                        <th colSpan={8} scope="rowgroup">
                          <span>{section.label}</span>
                          <span>{section.count}건 · {formatWon(section.total)}</span>
                        </th>
                      </tr>
                    </tbody>
                    {section.groups.map((group) => (
                      <tbody key={`${section.expenseType}-${group.scheduledDate}`} className="spreadsheet-group">
                        {group.rows.map(({ entry }, rowIndex) => (
                          <tr key={entry.id} className="spreadsheet-entry-row">
                            {rowIndex === 0 && (
                              <td className="spreadsheet-date" rowSpan={group.rows.length + 1}>
                                {group.scheduledDate}
                                <span className="spreadsheet-date-count">{group.rows.length}건</span>
                              </td>
                            )}
                            <td>
                              <span className={`expense-badge ${entry.expense_type === 'fixed' ? 'expense-badge-fixed' : 'expense-badge-subscription'}`}>
                                {entry.expense_type === 'fixed' ? '고정지출' : '구독'}
                              </span>
                            </td>
                            <td className="spreadsheet-name">{entry.name}</td>
                            <td className="spreadsheet-description">{entry.description || '—'}</td>
                            <td>{entry.schedule_type === 'one_time' ? '한 번만' : formatBilling(entry)}</td>
                            <td className="spreadsheet-number spreadsheet-price">{formatWon(entry.price)}</td>
                            {rowIndex === 0 && (
                              <td className="spreadsheet-number spreadsheet-balance" rowSpan={group.rows.length + 1}>
                                {group.projectedBalance === null ? '—' : formatWon(group.projectedBalance)}
                              </td>
                            )}
                            <td>
                              <Link className="spreadsheet-detail-link" href={`/subscriptions/${entry.id}`}>
                                상세
                              </Link>
                            </td>
                          </tr>
                        ))}
                        <tr className="spreadsheet-group-subtotal">
                          <th scope="row" colSpan={4}>날짜 소계</th>
                          <td className="spreadsheet-number">{formatWon(group.total)}</td>
                          <td />
                        </tr>
                      </tbody>
                    ))}
                  </Fragment>
                )) : (
                  <tbody>
                    <tr>
                      <td colSpan={8} className="spreadsheet-empty">이 달에 예정된 지출이 없습니다.</td>
                    </tr>
                  </tbody>
                )}
                {spreadsheetSections.length > 0 && (
                  <tfoot>
                    <tr>
                      <th scope="row" colSpan={5}>합계</th>
                      <td className="spreadsheet-number">{formatWon(minimumExpenditure)}</td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </section>
      </div>

      <Link href="/subscriptions/form" className="floating-add">
        <span aria-hidden="true">＋</span>
        <span>지출 추가</span>
      </Link>
    </main>
  );
}
