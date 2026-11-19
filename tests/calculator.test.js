import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProjection, calculatePortfolio, validateProduct, formatRocDate, formatTwd, formatCurrencyUnit, wanToTwd } from '../src/calculator.js';
import { getFeeRate, getMonthlyManagementFee } from '../src/feeRules.js';
import { createInitialAllocation, equalAllocationPercents, createAllocationRowId } from '../src/allocation.js';

test('非安全HTTP環境仍可建立基金配置識別碼', () => {
  assert.equal(createAllocationRowId({ randomUUID: null, now: () => 12345, random: () => 0.25 }), 'row-9ix-40000000');
  assert.equal(createAllocationRowId({ randomUUID: () => 'native-uuid' }), 'native-uuid');
});
import { createPdfLayout, createContainedPdfLayout, createReportPageGroups } from '../src/exportLayout.js';

test('五檔基金客戶報告以完整卡片分成兩頁', () => {
  assert.deepEqual(createReportPageGroups(1), [[0]]);
  assert.deepEqual(createReportPageGroups(2), [[0, 1]]);
  assert.deepEqual(createReportPageGroups(5), [[0, 1], [2, 3, 4]]);
});

test('一至兩檔基金的客戶報告會置中填滿A4橫式頁面', () => {
  const layout = createContainedPdfLayout({ canvasWidth: 2160, canvasHeight: 1718, pageWidthMm: 297, pageHeightMm: 210, marginMm: 10 });
  assert.equal(layout.pageCount, 1);
  assert.ok(layout.imageWidthMm > 238 && layout.imageWidthMm < 240);
  assert.equal(layout.imageHeightMm, 190);
  assert.ok(layout.xMm > 28 && layout.xMm < 30);
  assert.equal(layout.yMm, 10);
});

test('客戶報告PDF會依A4可用高度自動分頁', () => {
  const layout = createPdfLayout({ canvasWidth: 1080, canvasHeight: 2400, pageWidthMm: 210, pageHeightMm: 297, marginMm: 10 });
  assert.equal(layout.imageWidthMm, 190);
  assert.equal(layout.contentHeightMm, 277);
  assert.equal(layout.pageCount, 2);
  assert.deepEqual(layout.pageOffsetsMm, [0, 277]);
});

test('標的配置預設為一檔且占比100%', () => {
  assert.deepEqual(createInitialAllocation('fund-a', 'row-a'), { rowId: 'row-a', productId: 'fund-a', percent: 100 });
});

test('新增或刪除標的後可重新平均配置比例', () => {
  assert.deepEqual(equalAllocationPercents(1), [100]);
  assert.deepEqual(equalAllocationPercents(2), [50, 50]);
  assert.deepEqual(equalAllocationPercents(3), [33.33, 33.33, 33.34]);
});

test('扣除百分比費用後計算美元、單位數與月配息', () => {
  const result = calculateProjection({ amountTwd: 300000, feeRate: 3, fixedFeeTwd: 0, fxRate: 30.8, navUsd: 10, distributionUsd: 0.05 });
  assert.equal(result.netAmountTwd, 291000);
  assert.ok(Math.abs(result.usdAmount - 9448.051948) < 1e-6);
  assert.ok(Math.abs(result.units - 944.805195) < 1e-6);
  assert.ok(Math.abs(result.monthlyIncomeTwd - 1455) < 1e-6);
  assert.ok(Math.abs(result.annualIncomeTwd - 17460) < 1e-6);
});

test('美元基金以台銀賣出匯率申購、買入匯率換算配息', () => {
  const result = calculateProjection({ amountTwd: 320000, feeRate: 0, fixedFeeTwd: 0, purchaseFxRate: 32, dividendFxRate: 31, navUsd: 10, distributionUsd: 0.05, currency: 'USD' });
  assert.equal(result.currencyAmount, 10000);
  assert.equal(result.units, 1000);
  assert.equal(result.monthlyIncomeUsd, 50);
  assert.equal(result.monthlyIncomeTwd, 1550);
});

test('多標的依配置比例計算各自投入與總月配息', () => {
  const result = calculatePortfolio({
    netAmountTwd: 300000,
    purchaseFxRate: 30,
    dividendFxRate: 30,
    allocations: [
      { id: 'usd', currency: 'USD', percent: 50, nav: 10, distribution: 0.05 },
      { id: 'twd', currency: 'TWD', percent: 50, nav: 8, distribution: 0.04 }
    ]
  });
  assert.equal(result.items[0].investedTwd, 150000);
  assert.equal(result.items[0].monthlyIncomeTwd, 750);
  assert.equal(result.items[1].investedTwd, 150000);
  assert.equal(result.items[1].monthlyIncomeTwd, 750);
  assert.equal(result.totalMonthlyIncomeTwd, 1500);
  assert.equal(result.totalAnnualIncomeTwd, 18000);
});

test('多標的配置比例合計必須為100%', () => {
  assert.throws(() => calculatePortfolio({ netAmountTwd: 100000, purchaseFxRate: 30, dividendFxRate: 29, allocations: [{ id: 'a', currency: 'USD', percent: 60, nav: 10, distribution: 0.05 }] }), /100%/);
});

test('固定費與百分比費用可同時扣除', () => {
  const result = calculateProjection({ amountTwd: 500000, feeRate: 2, fixedFeeTwd: 1000, fxRate: 32, navUsd: 8, distributionUsd: 0.04 });
  assert.equal(result.totalFeeTwd, 11000);
  assert.equal(result.netAmountTwd, 489000);
});

test('台幣計價基金不換匯並以台幣淨值計算', () => {
  const result = calculateProjection({ amountTwd: 300000, feeRate: 0, fixedFeeTwd: 0, fxRate: 32, navUsd: 8, distributionUsd: 0.063, currency: 'TWD' });
  assert.equal(result.investmentCurrency, 'TWD');
  assert.equal(result.currencyAmount, 300000);
  assert.equal(result.units, 37500);
  assert.equal(result.monthlyIncomeTwd, 2362.5);
  assert.equal(result.annualIncomeTwd, 28350);
});

test('無效或不足的輸入會拒絕計算', () => {
  assert.throws(() => calculateProjection({ amountTwd: 0, feeRate: 0, fixedFeeTwd: 0, fxRate: 32, navUsd: 10, distributionUsd: 0.05 }), /投入金額/);
  assert.throws(() => calculateProjection({ amountTwd: 1000, feeRate: 100, fixedFeeTwd: 0, fxRate: 32, navUsd: 10, distributionUsd: 0.05 }), /費用/);
});

test('商品資料必須有名稱、淨值與每單位配息', () => {
  assert.equal(validateProduct({ name: '測試標的', navUsd: 10, distributionUsd: 0.05 }), true);
  assert.equal(validateProduct({ name: '', navUsd: 10, distributionUsd: 0.05 }), false);
});

test('商品費率依商品、年度、首續期與門檻判斷', () => {
  assert.equal(getFeeRate({ plan: 'ASVA', policyYear: 1, paymentType: 'first', currency: 'TWD', amount: 1199999 }), 3.8);
  assert.equal(getFeeRate({ plan: 'ASVA', policyYear: 1, paymentType: 'first', currency: 'TWD', amount: 1200000 }), 3.6);
  assert.equal(getFeeRate({ plan: 'NSVA', policyYear: 1, paymentType: 'first', currency: 'USD', amount: 39999 }), 3);
  assert.equal(getFeeRate({ plan: 'NSVA', policyYear: 1, paymentType: 'renewal', currency: 'USD', amount: 10000 }), 2.8);
  assert.equal(getFeeRate({ plan: 'DSVA', policyYear: 2, paymentType: 'first', currency: 'TWD', amount: 100000 }), 4.3);
});


test('DSVA及KVA每月管理費為100元且第一次繳費滿120萬元免收', () => {
  assert.deepEqual(getMonthlyManagementFee({ plan: 'DSVA', paymentType: 'first', firstPaymentTwd: 1199999 }), { applies: true, waived: false, feeTwd: 100, thresholdTwd: 1200000 });
  assert.deepEqual(getMonthlyManagementFee({ plan: 'DFVA', paymentType: 'first', firstPaymentTwd: 1200000 }), { applies: true, waived: true, feeTwd: 0, thresholdTwd: 1200000 });
  assert.deepEqual(getMonthlyManagementFee({ plan: 'KVA', paymentType: 'first', firstPaymentTwd: 1200000 }), { applies: true, waived: true, feeTwd: 0, thresholdTwd: 1200000 });
  assert.deepEqual(getMonthlyManagementFee({ plan: 'KFVA', paymentType: 'renewal', firstPaymentTwd: 2000000 }), { applies: true, waived: false, feeTwd: 100, thresholdTwd: 1200000 });
  assert.deepEqual(getMonthlyManagementFee({ plan: 'ASVA', paymentType: 'first', firstPaymentTwd: 2000000 }), { applies: false, waived: false, feeTwd: 0, thresholdTwd: 1200000 });
});

test('舊客戶第1年度商品費用套用第2年度費率', () => {
  assert.equal(getFeeRate({ plan: 'ASVA', policyYear: 1, paymentType: 'first', currency: 'TWD', amount: 300000, existingCustomer: true }), 3.6);
  assert.equal(getFeeRate({ plan: 'NSVA', policyYear: 1, paymentType: 'first', currency: 'TWD', amount: 300000, existingCustomer: true }), 2.8);
  assert.equal(getFeeRate({ plan: 'DSVA', policyYear: 1, paymentType: 'first', currency: 'TWD', amount: 300000, existingCustomer: true }), 4.3);
  assert.equal(getFeeRate({ plan: 'ASVA', policyYear: 1, paymentType: 'first', currency: 'TWD', amount: 300000, existingCustomer: false }), 3.8);
  assert.equal(getFeeRate({ plan: 'ASVA', policyYear: 2, paymentType: 'first', currency: 'TWD', amount: 300000, existingCustomer: true }), 3.6);
});

test('KVA與KFVA依各幣別繳費門檻判斷費率', () => {
  const cases = [
    ['TWD', 4999999, 5], ['TWD', 5000000, 4], ['TWD', 10000000, 3],
    ['USD', 149999, 5], ['USD', 150000, 4], ['USD', 300000, 3],
    ['EUR', 149999, 5], ['EUR', 150000, 4], ['EUR', 300000, 3],
    ['AUD', 199999, 5], ['AUD', 200000, 4], ['AUD', 400000, 3],
    ['CNY', 999999, 5], ['CNY', 1000000, 4], ['CNY', 2000000, 3]
  ];
  for (const [currency, amount, expected] of cases) {
    assert.equal(getFeeRate({ plan: 'KVA', currency, amount }), expected);
    assert.equal(getFeeRate({ plan: 'KFVA', currency, amount }), expected);
  }
});

test('不支援的商品費率條件會拒絕計算', () => {
  assert.throws(() => getFeeRate({ plan: 'ASVA', policyYear: 1, paymentType: 'first', currency: 'EUR', amount: 1000 }), /幣別/);
  assert.throws(() => getFeeRate({ plan: 'KVA', currency: 'JPY', amount: 1000 }), /幣別/);
});


test('投入金額以萬元輸入並轉換為台幣', () => {
  assert.equal(wanToTwd(10), 100000);
  assert.equal(wanToTwd(30.5), 305000);
  assert.throws(() => wanToTwd(9.99), /10萬元/);
});

test('日期顯示為民國年', () => {
  assert.equal(formatRocDate(new Date('2026-11-17T12:00:00+08:00')), '民國115年11月17日');
});

test('基金單位淨值與單位配息保留必要小數', () => {
  assert.equal(formatCurrencyUnit(8.01, 'TWD'), 'NT$ 8.01');
  assert.equal(formatCurrencyUnit(0.063, 'TWD'), 'NT$ 0.063');
  assert.equal(formatCurrencyUnit(0.0724, 'USD'), 'US$ 0.0724');
});

test('台幣金額明確顯示 NT$ 前綴', () => {
  assert.equal(formatTwd(1500), 'NT$ 1,500');
});
