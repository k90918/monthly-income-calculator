export const TWO_STAGE_FUND_IDS = new Set([
  'MSC00012',
  'MFD00022',
  'MFK00012',
  'MDI00012',
  'MSN00110'
]);

export const TWO_STAGE_BASIC_PER_UNIT = 0.042;
export const TWO_STAGE_BONUS_PER_UNIT = 0.1;

const round = value => Math.round((value + Number.EPSILON) * 100000000) / 100000000;

function payoutTwd(item, perUnit, dividendFxRate) {
  const amount = Number(item.units) * perUnit;
  return item.currency === 'TWD' ? amount : amount * Number(dividendFxRate);
}

export function calculateTwoStageReturn({ items, dividendFxRate }) {
  const eligible = (items || []).filter(item => TWO_STAGE_FUND_IDS.has(item.id));
  if (eligible.length === 0) return null;
  if (!(Number(dividendFxRate) > 0) && eligible.some(item => item.currency === 'USD')) {
    throw new Error('匯率必須大於 0');
  }

  const bonusPerUnit = TWO_STAGE_BASIC_PER_UNIT + TWO_STAGE_BONUS_PER_UNIT;
  const eligibleInvestmentTwd = eligible.reduce((sum, item) => sum + Number(item.investedTwd), 0);
  const basicMonthlyTwd = eligible.reduce((sum, item) => sum + payoutTwd(item, TWO_STAGE_BASIC_PER_UNIT, dividendFxRate), 0);
  const bonusMonthlyTwd = eligible.reduce((sum, item) => sum + payoutTwd(item, bonusPerUnit, dividendFxRate), 0);
  const basicAnnualTwd = basicMonthlyTwd * 12;
  const bonusAnnualTwd = bonusMonthlyTwd * 12;

  return {
    eligibleIds: eligible.map(item => item.id),
    currencies: [...new Set(eligible.map(item => item.currency))],
    eligibleInvestmentTwd: round(eligibleInvestmentTwd),
    basicPerUnit: TWO_STAGE_BASIC_PER_UNIT,
    bonusPerUnit: TWO_STAGE_BONUS_PER_UNIT,
    totalBonusPerUnit: bonusPerUnit,
    basicMonthlyTwd: round(basicMonthlyTwd),
    bonusMonthlyTwd: round(bonusMonthlyTwd),
    basicAnnualTwd: round(basicAnnualTwd),
    bonusAnnualTwd: round(bonusAnnualTwd),
    basicAnnualRate: round(basicAnnualTwd / eligibleInvestmentTwd * 100),
    bonusAnnualRate: round(bonusAnnualTwd / eligibleInvestmentTwd * 100)
  };
}

function localDate(year, monthIndex, day) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function nextBusinessDay(date) {
  const result = new Date(date);
  result.setDate(result.getDate() + 1);
  while (result.getDay() === 0 || result.getDay() === 6) result.setDate(result.getDate() + 1);
  return result;
}

function monthlyBaseDate(year, monthIndex) {
  const date = localDate(year, monthIndex, 8);
  if (date.getDay() === 6) date.setDate(10);
  if (date.getDay() === 0) date.setDate(9);
  return date;
}

function isoLocal(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function getTwoStagePeriod(today = new Date()) {
  const currentBase = monthlyBaseDate(today.getFullYear(), today.getMonth());
  const baseDate = today <= currentBase
    ? currentBase
    : monthlyBaseDate(today.getFullYear(), today.getMonth() + 1);
  const previousBase = monthlyBaseDate(baseDate.getFullYear(), baseDate.getMonth() - 1);
  return {
    baseDate: isoLocal(baseDate),
    observationStart: isoLocal(nextBusinessDay(previousBase)),
    observationEnd: isoLocal(baseDate)
  };
}
