import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('商品名稱移除世紀得利並提供每月管理費欄位', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const productSelect = html.match(/<select id="feePlan">([\s\S]*?)<\/select>/)?.[1] || '';
  assert.doesNotMatch(productSelect, /世紀得利/);
  assert.match(html, /id="inputManagementFee"/);
  assert.match(html, /id="summaryManagementFee"/);
  assert.doesNotMatch(html, /id="summaryFundCount"/);
});

test('商品費用位置提供舊客戶切換按鈕', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="existingCustomerBtn"/);
  assert.match(html, /aria-pressed="false"/);
  assert.match(html, />舊客戶<\/button>/);
  assert.match(html, /id="existingCustomerStatus"/);
});

test('報告提供全委帳戶兩段式預估撥回區塊', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /id="twoStageSection"/);
  assert.match(html, /id="twoStageBasicMonthly"/);
  assert.match(html, /id="twoStageBonusMonthly"/);
  assert.match(html, /全委帳戶兩段式撥回機制/);
});
