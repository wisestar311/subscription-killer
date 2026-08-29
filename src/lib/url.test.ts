import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeHttpUrl } from './url';

test('해지 링크는 HTTP와 HTTPS만 허용한다', () => {
  assert.equal(getSafeHttpUrl('https://example.com/cancel'), 'https://example.com/cancel');
  assert.equal(getSafeHttpUrl('javascript:alert(1)'), null);
  assert.equal(getSafeHttpUrl('ftp://example.com'), null);
  assert.equal(getSafeHttpUrl('not a url'), null);
});
