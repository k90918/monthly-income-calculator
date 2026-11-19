import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTwoStageReturn, getTwoStagePeriod } from '../src/twoStageReturn.js';

test('五檔全委帳戶以每單位0.042與0.142比較兩段式預估撥回', () => {
  const result = calculateTwoStageReturn({
    dividendFxRate: 30,
    items: [
      { id: 'MFD00022', currency: 'USD', units: 100, investedTwd: 1000 },
      { id: 'MDI00012', currency: 'TWD', units: 200, investedTwd: 2000 },
      { id: '007117', currency: 'USD', units: 999, investedTwd: 9999 }
    ]
  });

  assert.deepEqual(result.eligibleIds, ['MFD00022', 'MDI00012']);
  assert.equal(result.eligibleInvestmentTwd, 3000);
  assert.equal(result.basicMonthlyTwd, 134.4);
  assert.equal(result.bonusMonthlyTwd, 454.4);
  assert.equal(result.basicAnnualTwd, 1612.8);
  assert.equal(result.bonusAnnualTwd, 5452.8);
  assert.equal(result.basicAnnualRate, 53.76);
  assert.equal(result.bonusAnnualRate, 181.76);
});

test('未選到五檔全委帳戶時不顯示兩段式預估', () => {
  const result = calculateTwoStageReturn({
    dividendFxRate: 30,
    items: [{ id: '007117', currency: 'USD', units: 100, investedTwd: 1000 }]
  });
  assert.equal(result, null);
});

test('基準日為每月8日遇週末順延且觀察期從前月基準日次一營業日起算', () => {
  const period = getTwoStagePeriod(new Date(2026, 10, 19));
  assert.equal(period.baseDate, '2026-12-08');
  assert.equal(period.observationStart, '2026-11-10');
  assert.equal(period.observationEnd, '2026-12-08');
});

test('基準日當天仍使用本月，隔天改顯示下個月', () => {
  assert.equal(getTwoStagePeriod(new Date(2026, 11, 8)).baseDate, '2026-12-08');
  assert.equal(getTwoStagePeriod(new Date(2026, 11, 9)).baseDate, '2027-01-08');
});
