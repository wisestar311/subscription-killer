import assert from 'node:assert/strict';
import test from 'node:test';
import { addDays, getCalendarCells, getKstToday, getScheduledDate } from './schedule';

test('31일 결제는 짧은 달의 말일로 보정한다', () => {
  assert.equal(getScheduledDate(2026, 1, 31), '2026-02-28');
  assert.equal(getScheduledDate(2028, 1, 31), '2028-02-29');
  assert.equal(getScheduledDate(2026, 3, 31), '2026-04-30');
});

test('날짜 더하기는 월과 연도 경계를 처리한다', () => {
  assert.equal(addDays('2026-12-31', 2), '2027-01-02');
});

test('UTC 시각을 한국 날짜로 변환한다', () => {
  assert.equal(getKstToday(new Date('2026-08-28T16:00:00Z')), '2026-08-29');
});

test('캘린더 셀은 완전한 주 단위로 생성한다', () => {
  const cells = getCalendarCells(2026, 7);
  assert.equal(cells.length % 7, 0);
  assert.equal(cells.filter(Boolean).length, 31);
});
