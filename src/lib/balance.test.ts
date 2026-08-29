import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBalance, parseBalanceFromMessage } from './balance';

test('은행 문자에서 잔액을 추출한다', () => {
  assert.equal(parseBalanceFromMessage('[은행] 출금 12,000원 잔액 1,234,567원'), 1_234_567);
  assert.equal(parseBalanceFromMessage('출금가능금액: ₩987,654'), 987_654);
  assert.equal(parseBalanceFromMessage('Available balance KRW 42,000'), 42_000);
});

test('거래 금액만 있는 문자는 잔액으로 오인하지 않는다', () => {
  assert.equal(parseBalanceFromMessage('[카드] 승인 17,000원'), null);
});

test('유효하지 않은 직접 입력을 거부한다', () => {
  assert.equal(normalizeBalance('-1'), null);
  assert.equal(normalizeBalance('12.5'), null);
  assert.equal(normalizeBalance('123,000원'), 123_000);
});
