import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeBalance,
  parseBalanceFromMessage,
  parseBalanceImportPayload,
} from './balance';

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

test('iOS 단축어의 일반 텍스트 메시지를 요청 본문으로 처리한다', () => {
  assert.deepEqual(
    parseBalanceImportPayload('[은행] 잔액 369,160원', 'text/plain; charset=utf-8'),
    { message: '[은행] 잔액 369,160원' },
  );
});

test('기존 JSON과 폼 요청도 계속 처리한다', () => {
  assert.deepEqual(
    parseBalanceImportPayload('{"token":"abc","balance":123}', 'application/json'),
    { token: 'abc', balance: 123 },
  );
  assert.deepEqual(
    parseBalanceImportPayload('token=abc&message=%EC%9E%94%EC%95%A1+123%EC%9B%90', 'application/x-www-form-urlencoded'),
    { token: 'abc', balance: undefined, message: '잔액 123원' },
  );
  assert.equal(parseBalanceImportPayload('{', 'application/json'), null);
});

test('curl -d 기본 Content-Type(form-urlencoded)으로 보낸 JSON 본문도 처리한다', () => {
  assert.deepEqual(
    parseBalanceImportPayload('{"token":"abc","balance":123}', 'application/x-www-form-urlencoded'),
    { token: 'abc', balance: 123 },
  );
});

test('폼 요청의 빈 balance 값은 미입력으로 처리한다', () => {
  assert.deepEqual(
    parseBalanceImportPayload('token=abc&balance=&message=%EC%9E%94%EC%95%A1+123%EC%9B%90', 'application/x-www-form-urlencoded'),
    { token: 'abc', balance: undefined, message: '잔액 123원' },
  );
});
