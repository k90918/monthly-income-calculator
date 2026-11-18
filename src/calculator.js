export function calculateProjection(input) {
  const amountTwd = Number(input.amountTwd);
  const feeRate = Number(input.feeRate || 0);
  const fixedFeeTwd = Number(input.fixedFeeTwd || 0);
  const purchaseFxRate = Number(input.purchaseFxRate ?? input.fxRate);
  const dividendFxRate = Number(input.dividendFxRate ?? input.fxRate ?? input.purchaseFxRate);
  const navUsd = Number(input.navUsd);
  const distributionUsd = Number(input.distributionUsd);
  const investmentCurrency = String(input.currency || 'USD').toUpperCase();

  if (!['USD', 'TWD'].includes(investmentCurrency)) throw new Error('目前僅支援美元或新台幣計價基金');
  if (!(amountTwd > 0)) throw new Error('投入金額必須大於 0');
  if (feeRate < 0 || fixedFeeTwd < 0) throw new Error('費用不可小於 0');
  if (!(purchaseFxRate > 0) || !(dividendFxRate > 0)) throw new Error('匯率必須大於 0');
  if (!(navUsd > 0)) throw new Error('單位淨值必須大於 0');
  if (distributionUsd < 0) throw new Error('月配息不可小於 0');

  const percentageFeeTwd = amountTwd * feeRate / 100;
  const totalFeeTwd = percentageFeeTwd + fixedFeeTwd;
  const netAmountTwd = amountTwd - totalFeeTwd;
  if (!(netAmountTwd > 0)) throw new Error('費用不可等於或超過投入金額');

  const currencyAmount = investmentCurrency === 'TWD' ? netAmountTwd : netAmountTwd / purchaseFxRate;
  const units = currencyAmount / navUsd;
  const monthlyIncomeCurrency = units * distributionUsd;
  const monthlyIncomeTwd = investmentCurrency === 'TWD' ? monthlyIncomeCurrency : monthlyIncomeCurrency * dividendFxRate;
  const annualIncomeTwd = monthlyIncomeTwd * 12;
  const annualDistributionRate = annualIncomeTwd / netAmountTwd * 100;

  return {
    investmentCurrency,
    purchaseFxRate,
    dividendFxRate,
    percentageFeeTwd,
    totalFeeTwd,
    netAmountTwd,
    currencyAmount,
    usdAmount: investmentCurrency === 'USD' ? currencyAmount : null,
    units,
    monthlyIncomeCurrency,
    monthlyIncomeUsd: investmentCurrency === 'USD' ? monthlyIncomeCurrency : null,
    monthlyIncomeTwd,
    annualIncomeTwd,
    annualDistributionRate
  };
}

export function calculatePortfolio({ netAmountTwd, purchaseFxRate, dividendFxRate, allocations }) {
  const net = Number(netAmountTwd);
  if (!(net > 0)) throw new Error('淨投入金額必須大於 0');
  if (!Array.isArray(allocations) || allocations.length === 0) throw new Error('至少選擇一檔標的');
  const totalPercent = allocations.reduce((sum, item) => sum + Number(item.percent || 0), 0);
  if (Math.abs(totalPercent - 100) > 0.001) throw new Error('配置比例合計必須為100%');

  const items = allocations.map(item => {
    const currency = String(item.currency || 'USD').toUpperCase();
    const percent = Number(item.percent);
    const nav = Number(item.nav);
    const distribution = Number(item.distribution);
    if (!['USD', 'TWD'].includes(currency)) throw new Error('目前僅支援美元或新台幣計價基金');
    if (!(percent >= 0) || !(nav > 0) || !(distribution >= 0)) throw new Error('標的配置資料不完整');
    if (currency === 'USD' && (!(Number(purchaseFxRate) > 0) || !(Number(dividendFxRate) > 0))) throw new Error('匯率必須大於 0');

    const investedTwd = net * percent / 100;
    const currencyAmount = currency === 'TWD' ? investedTwd : investedTwd / Number(purchaseFxRate);
    const units = currencyAmount / nav;
    const monthlyIncomeCurrency = units * distribution;
    const monthlyIncomeTwd = currency === 'TWD' ? monthlyIncomeCurrency : monthlyIncomeCurrency * Number(dividendFxRate);
    return { ...item, currency, percent, investedTwd, currencyAmount, units, monthlyIncomeCurrency, monthlyIncomeTwd };
  });

  const totalMonthlyIncomeTwd = items.reduce((sum, item) => sum + item.monthlyIncomeTwd, 0);
  return { items, totalPercent, totalMonthlyIncomeTwd, totalAnnualIncomeTwd: totalMonthlyIncomeTwd * 12 };
}

export function validateProduct(product) {
  return Boolean(
    product &&
    String(product.name || '').trim() &&
    Number(product.navUsd) > 0 &&
    Number(product.distributionUsd) >= 0
  );
}

export function wanToTwd(value) {
  const amountWan = Number(value);
  if (!(amountWan >= 10)) throw new Error('投入金額最低為10萬元');
  return amountWan * 10000;
}

export function formatRocDate(date = new Date()) {
  return `民國${date.getFullYear() - 1911}年${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatCurrencyUnit(value, currency) {
  const amount = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(value);
  if (currency === 'TWD') return `NT$ ${amount}`;
  if (currency === 'USD') return `US$ ${amount}`;
  throw new Error('不支援的幣別');
}

export function formatTwd(value) {
  return `NT$ ${new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 }).format(value)}`;
}
