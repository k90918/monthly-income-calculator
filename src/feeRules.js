const STANDARD_PLANS = {
  ASVA: { high: 3.8, low: 3.6 },
  AFVA: { high: 3.8, low: 3.6 },
  NSVA: { high: 3.0, low: 2.8 },
  NFVA: { high: 3.0, low: 2.8 },
  DSVA: { high: 4.5, low: 4.3 },
  DFVA: { high: 4.5, low: 4.3 }
};

const STANDARD_THRESHOLDS = { TWD: 1200000, USD: 40000 };
const KVA_THRESHOLDS = {
  TWD: [5000000, 10000000],
  USD: [150000, 300000],
  EUR: [150000, 300000],
  AUD: [200000, 400000],
  CNY: [1000000, 2000000]
};


const MONTHLY_MANAGEMENT_FEE_PLANS = new Set(['DSVA', 'DFVA', 'KVA', 'KFVA']);
const MONTHLY_MANAGEMENT_FEE_TWD = 100;
const MONTHLY_MANAGEMENT_FEE_WAIVER_TWD = 1200000;

export function getMonthlyManagementFee({ plan, paymentType = 'first', firstPaymentTwd }) {
  const applies = MONTHLY_MANAGEMENT_FEE_PLANS.has(String(plan || '').toUpperCase());
  const amount = Number(firstPaymentTwd);
  if (!(amount >= 0)) throw new Error('第一次繳費金額不可小於0');
  const waived = applies && paymentType === 'first' && amount >= MONTHLY_MANAGEMENT_FEE_WAIVER_TWD;
  return {
    applies,
    waived,
    feeTwd: applies && !waived ? MONTHLY_MANAGEMENT_FEE_TWD : 0,
    thresholdTwd: MONTHLY_MANAGEMENT_FEE_WAIVER_TWD
  };
}

export function getFeeRate({ plan, policyYear = 1, paymentType = 'first', currency = 'TWD', amount, existingCustomer = false }) {
  const normalizedPlan = String(plan || '').toUpperCase();
  const normalizedCurrency = String(currency || '').toUpperCase();
  const numericAmount = Number(amount);
  if (!(numericAmount >= 0)) throw new Error('費率判定金額不可小於 0');

  if (normalizedPlan === 'KVA' || normalizedPlan === 'KFVA') {
    const thresholds = KVA_THRESHOLDS[normalizedCurrency];
    if (!thresholds) throw new Error('KVA／KFVA 不支援此繳費幣別');
    if (numericAmount < thresholds[0]) return 5;
    if (numericAmount < thresholds[1]) return 4;
    return 3;
  }

  const rates = STANDARD_PLANS[normalizedPlan];
  if (!rates) throw new Error('不支援此商品費率');
  const threshold = STANDARD_THRESHOLDS[normalizedCurrency];
  if (!threshold) throw new Error('此商品費率僅支援新台幣或美元幣別');

  const effectivePolicyYear = existingCustomer && Number(policyYear) === 1 ? 2 : Number(policyYear);
  const isFirstYearFirstPayment = effectivePolicyYear === 1 && paymentType === 'first';
  return isFirstYearFirstPayment && numericAmount < threshold ? rates.high : rates.low;
}

export const feeRuleOptions = {
  standardPlans: Object.keys(STANDARD_PLANS),
  standardCurrencies: Object.keys(STANDARD_THRESHOLDS),
  kvaCurrencies: Object.keys(KVA_THRESHOLDS)
};
