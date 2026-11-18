import { calculatePortfolio, formatRocDate, formatTwd, formatCurrencyUnit, wanToTwd } from './src/calculator.js?v=22';
import { getFeeRate, getMonthlyManagementFee } from './src/feeRules.js?v=22';
import { createInitialAllocation, equalAllocationPercents, createAllocationRowId } from './src/allocation.js?v=22';
import { createContainedPdfLayout, createReportPageGroups } from './src/exportLayout.js?v=22';

const FUND_DATA_KEY = 'monthly-income-fixed-funds-v3';
const FX_KEY = 'monthly-income-bot-fx-v2';
const BOT_RATE_MIRROR = 'https://raw.githubusercontent.com/haotool/app/data/public/rates/latest.json';
const FUNDRICH_API = 'https://apis.fundrich.com.tw/FRSDataCenter';
const defaultProducts = [
  { id: '007117', fundId: '007117', name: '摩根投資基金－多重收益基金－JPM多重收益（美元對沖）－A股（穩定月配）', navUsd: 70.82, distributionUsd: 0.597, currency: 'USD', dataDate: '2026-11-16', dividendDate: '2026-11-10' },
  { id: '019070', fundId: '019070', name: '安聯收益成長基金－AMg7月收總收益類股（美元）', navUsd: 8.1395, distributionUsd: 0.0724, currency: 'USD', dataDate: '2026-11-16', dividendDate: '2026-11-16' },
  { id: '116072', fundId: '116072', name: '富蘭克林坦伯頓全球投資系列－穩定月收益基金美元A（Mdis）股', navUsd: 9.67, distributionUsd: 0.067, currency: 'USD', dataDate: '2026-11-16', dividendDate: '2026-11-02' },
  { id: 'ALI054', fundId: 'ALI054', name: '安聯收益成長多重資產基金－B類型（月配息）－新臺幣', navUsd: 8.01, distributionUsd: 0.063, currency: 'TWD', dataDate: '2026-11-13', dividendDate: '2026-10-29' },
  { id: 'FTS075', fundId: 'FTS075', name: '富蘭克林華美特別股收益基金－新台幣B分配型', navUsd: 6.37, distributionUsd: 0.039, currency: 'TWD', dataDate: '2026-11-13', dividendDate: '2026-11-02' },
  { id: 'MSC00012', fundId: 'MSC00012', source: 'moneydj', name: '三商美邦人壽環球365投資帳戶-A1', navUsd: 9.67, distributionUsd: 0.142, currency: 'USD', dataDate: '2026-11-16', dividendDate: '2026-11-10' },
  { id: 'MFD00022', fundId: 'MFD00022', source: 'moneydj', name: '三商美邦人壽環球策略2.0投資帳戶-A1', navUsd: 9.5, distributionUsd: 0.042, currency: 'USD', dataDate: '2026-11-16', dividendDate: '2026-11-10' },
  { id: 'MFK00012', fundId: 'MFK00012', source: 'moneydj', name: '三商美邦人壽鑫收益投資帳戶-A1', navUsd: 9.37, distributionUsd: 0.042, currency: 'USD', dataDate: '2026-11-16', dividendDate: '2026-11-10' },
  { id: 'MDI00012', fundId: 'MDI00012', source: 'moneydj', name: '三商美邦人壽鑫穩健投資帳戶-A1', navUsd: 10.87, distributionUsd: 0.142, currency: 'TWD', dataDate: '2026-11-16', dividendDate: '2026-11-10' },
  { id: 'MSN00110', fundId: 'MSN00110', source: 'moneydj', name: '三商美邦人壽e指穩投資帳戶-A1', navUsd: 10.86, distributionUsd: 0.142, currency: 'TWD', dataDate: '2026-11-16', dividendDate: '2026-11-10' }
];

const $ = id => document.getElementById(id);
let products = loadProducts();
let allocations = [createInitialAllocation(products[0].id, createAllocationRowId())];
let currentFeeRate = 0;
let existingCustomer = false;

function localIsoDate(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function apiDateToRoc(value) {
  if (!value || value === '--') return '—';
  return formatRocDate(new Date(`${String(value).replaceAll('/', '-')}T12:00:00`));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

function loadProducts() {
  try {
    const saved = JSON.parse(localStorage.getItem(FUND_DATA_KEY));
    if (!Array.isArray(saved)) return structuredClone(defaultProducts);
    const savedById = new Map(saved.map(product => [product.id, product]));
    return defaultProducts.map(product => ({ ...product, ...(savedById.get(product.id) || {}) }));
  } catch { return structuredClone(defaultProducts); }
}

function saveProducts() {
  localStorage.setItem(FUND_DATA_KEY, JSON.stringify(products));
}

function numberValue(id) { return Number($(id).value); }
function investmentAmountTwd() { return wanToTwd(numberValue('amountTwd')); }
function syncFeeBasisFromInvestment() {
  if ($('feeCurrency').value !== 'TWD') return;
  try { $('feeBasisAmount').value = investmentAmountTwd(); } catch { /* 等待有效輸入 */ }
}
const twd = value => formatTwd(value);
const num = (value, digits = 4) => new Intl.NumberFormat('zh-TW', { maximumFractionDigits: digits }).format(value);
const moneyByCurrency = (value, currency) => formatCurrencyUnit(value, currency);

function productOptions(selectedId) {
  return products.map(product => `<option value="${product.id}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name)}</option>`).join('');
}

function renderAllocationRows() {
  $('allocationRows').innerHTML = allocations.map((allocation, index) => {
    const product = products.find(item => item.id === allocation.productId) || products[0];
    return `<article class="allocation-row" data-row-id="${allocation.rowId}">
      <div class="allocation-index">${index + 1}</div>
      <label class="field allocation-fund"><span>選擇標的</span><select class="allocation-product">${productOptions(product.id)}</select><small>${product.currency}｜淨值日 ${apiDateToRoc(product.dataDate)}｜配息除息日 ${apiDateToRoc(product.dividendDate)}</small></label>
      <label class="field allocation-percent"><span>配置比例（%）</span><input class="allocation-percent-input" type="number" inputmode="decimal" enterkeyhint="done" min="0" max="100" step="0.01" value="${allocation.percent}"></label>
      <div class="allocation-preview"><span>投入金額</span><strong class="allocation-amount">—</strong></div>
      <div class="allocation-preview"><span>預估月配息</span><strong class="allocation-income">—</strong></div>
      <button class="remove-allocation" type="button" ${allocations.length <= 1 ? 'disabled' : ''} aria-label="移除標的">×</button>
    </article>`;
  }).join('');
}

function equalizeAllocations() {
  const percents = equalAllocationPercents(allocations.length);
  allocations.forEach((allocation, index) => { allocation.percent = percents[index]; });
}

function addAllocation() {
  if (allocations.length >= products.length) {
    $('errorMessage').textContent = '所有標的都已加入。';
    return;
  }
  const used = new Set(allocations.map(item => item.productId));
  const nextProduct = products.find(product => !used.has(product.id));
  allocations.push({ rowId: createAllocationRowId(), productId: nextProduct.id, percent: 0 });
  equalizeAllocations();
  renderAllocationRows();
  calculateAndRender();
}

function removeAllocation(rowId) {
  if (allocations.length <= 1) return;
  allocations = allocations.filter(item => item.rowId !== rowId);
  equalizeAllocations();
  renderAllocationRows();
  calculateAndRender();
}

function allocationInputs() {
  return allocations.map(allocation => {
    const product = products.find(item => item.id === allocation.productId);
    return {
      id: product.id,
      name: product.name,
      currency: product.currency,
      percent: allocation.percent,
      nav: product.navUsd,
      distribution: product.distributionUsd,
      dataDate: product.dataDate,
      dividendDate: product.dividendDate
    };
  });
}

function setFeeCurrencyOptions(currencies) {
  const labels = { TWD: '新台幣', USD: '美元', EUR: '歐元', AUD: '澳幣', CNY: '人民幣' };
  const current = $('feeCurrency').value;
  $('feeCurrency').innerHTML = currencies.map(currency => `<option value="${currency}">${labels[currency]}</option>`).join('');
  if (currencies.includes(current)) $('feeCurrency').value = current;
}

function updateFeeControls() {
  const isKva = $('feePlan').value === 'KVA';
  $('policyYear').disabled = isKva;
  $('paymentType').disabled = false;
  setFeeCurrencyOptions(isKva ? ['TWD', 'USD', 'EUR', 'AUD', 'CNY'] : ['TWD', 'USD']);
  syncFeeBasisFromInvestment();
  updateFeeRate();
}

function updateFeeRate() {
  try {
    currentFeeRate = getFeeRate({
      plan: $('feePlan').value,
      policyYear: Number($('policyYear').value),
      paymentType: $('paymentType').value,
      currency: $('feeCurrency').value,
      amount: numberValue('feeBasisAmount'),
      existingCustomer
    });
    const prefix = $('feePlan').value === 'KVA'
      ? `依${$('feeCurrency').selectedOptions[0].textContent}繳費級距`
      : `${$('policyYear').selectedOptions[0].textContent}／${$('paymentType').selectedOptions[0].textContent}`;
    $('feeRuleStatus').textContent = `${prefix}自動判定商品費用 ${currentFeeRate}%`;
    $('existingCustomerStatus').textContent = existingCustomer ? '舊客戶' : '一般客戶費率';
    calculateAndRender();
  } catch (error) {
    $('feeRuleStatus').textContent = error.message;
  }
}

function calculateAndRender() {
  const totalPercent = allocations.reduce((sum, item) => sum + Number(item.percent || 0), 0);
  $('allocationStatus').textContent = `配置合計 ${num(totalPercent, 2)}%`;
  $('allocationStatus').classList.toggle('invalid', Math.abs(totalPercent - 100) > 0.001);
  try {
    const productIds = allocations.map(item => item.productId);
    if (new Set(productIds).size !== productIds.length) throw new Error('同一檔標的不可重複選擇');
    const amountTwd = investmentAmountTwd();
    if (!(amountTwd > 0)) throw new Error('投入金額必須大於0');
    const totalFeeTwd = amountTwd * currentFeeRate / 100;
    const netAmountTwd = amountTwd - totalFeeTwd;
    const managementFee = getMonthlyManagementFee({
      plan: $('feePlan').value,
      paymentType: $('paymentType').value,
      firstPaymentTwd: amountTwd
    });
    const managementFeeText = managementFee.applies
      ? (managementFee.waived ? '免收' : twd(managementFee.feeTwd))
      : '無';
    $('inputFeeAmount').textContent = twd(totalFeeTwd);
    $('inputFeeDetail').textContent = `費率 ${num(currentFeeRate, 2)}%｜扣除後 ${twd(netAmountTwd)}`;
    $('inputManagementFee').textContent = managementFeeText;
    $('managementFeeDetail').textContent = managementFee.applies
      ? (managementFee.waived
        ? `第一次繳費達 ${twd(managementFee.thresholdTwd)}，免收管理費`
        : `每月收取 ${twd(managementFee.feeTwd)}｜不從月配息中扣除`)
      : '僅DSVA／DFVA及KVA／KFVA適用';
    const result = calculatePortfolio({
      netAmountTwd,
      purchaseFxRate: numberValue('purchaseFxRate'),
      dividendFxRate: numberValue('dividendFxRate'),
      allocations: allocationInputs()
    });

    $('errorMessage').textContent = '';
    $('reportDate').textContent = formatRocDate(new Date());
    $('monthlyIncomeTwd').textContent = twd(result.totalMonthlyIncomeTwd);
    $('annualIncomeTwd').textContent = twd(result.totalAnnualIncomeTwd);
    $('summaryAmount').textContent = twd(amountTwd);
    $('summaryFee').textContent = `${twd(totalFeeTwd)}（${num(currentFeeRate, 2)}%）`;
    $('summaryManagementFee').textContent = managementFeeText;
    $('summaryNet').textContent = twd(netAmountTwd);
    $('selectedFundCount').textContent = `${result.items.length}檔`;
    $('selectedFundSummary').innerHTML = result.items.map(item => `<article class="selected-fund-card"><span>${escapeHtml(item.name)}</span><strong>${twd(item.monthlyIncomeTwd)}</strong><small>預估月配息</small></article>`).join('');
    $('portfolioTotalMonthly').textContent = twd(result.totalMonthlyIncomeTwd);
    $('annualRate').textContent = `${num(result.totalAnnualIncomeTwd / netAmountTwd * 100, 2)}%`;

    result.items.forEach((item, index) => {
      const row = document.querySelector(`[data-row-id="${allocations[index].rowId}"]`);
      if (row) {
        row.querySelector('.allocation-amount').textContent = twd(item.investedTwd);
        row.querySelector('.allocation-income').textContent = twd(item.monthlyIncomeTwd);
      }
    });

    $('portfolioCards').innerHTML = result.items.map((item, index) => `<article class="report-fund-card">
      <div class="report-fund-top">
        <span class="report-fund-index">${String(index + 1).padStart(2, '0')}</span>
        <div class="report-fund-name"><h4>${escapeHtml(item.name)}</h4><p>配置 ${num(item.percent, 2)}%｜投入 ${twd(item.investedTwd)}</p></div>
        <div class="report-fund-income"><span>預估月配息</span><strong>${twd(item.monthlyIncomeTwd)}</strong></div>
      </div>
      <div class="report-fund-meta">
        <span>單位淨值 ${moneyByCurrency(item.nav, item.currency)}</span>
        <span>購買單位 ${num(item.units, 4)}</span>
        <span>每單位月配息 ${moneyByCurrency(item.distribution, item.currency)}</span>
      </div>
    </article>`).join('');
  } catch (error) {
    $('errorMessage').textContent = error.message;
  }
}

async function postFundRich(path, fundId) {
  const response = await fetch(`${FUNDRICH_API}/${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { fundId } }), cache: 'no-store'
  });
  if (!response.ok) throw new Error('基金資料服務無回應');
  const json = await response.json();
  if (json.status !== 0 || !json.data) throw new Error(json.msg || '基金資料格式錯誤');
  return json.data;
}

async function refreshAllFunds() {
  const button = $('refreshFundsBtn');
  button.disabled = true;
  $('fundStatus').textContent = `正在更新${products.length}檔基金的淨值與最近配息…`;
  let successCount = 0;
  let moneyDjByCode = new Map();
  try {
    const response = await fetch(`./data/moneydj.json?ts=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      moneyDjByCode = new Map((payload.funds || []).map(fund => [fund.code, fund]));
    }
  } catch { /* 離線時沿用快取或已儲存資料 */ }
  await Promise.all(products.map(async (product, index) => {
    try {
      if (product.source === 'moneydj') {
        const data = moneyDjByCode.get(product.fundId);
        if (!data) throw new Error('MoneyDJ基金資料服務無回應');
        products[index] = {
          ...product,
          name: data.name || product.name,
          navUsd: Number(data.nav),
          distributionUsd: Number(data.distribution),
          currency: data.currency || product.currency,
          dataDate: data.dataDate || product.dataDate,
          dividendDate: data.dividendDate || product.dividendDate
        };
      } else {
        const [detail, dividend] = await Promise.all([
          postFundRich('GetFundDetail', product.fundId),
          postFundRich('GetFundDividendInfo', product.fundId)
        ]);
        const distribution = Number.parseFloat(dividend?.lastTime?.list?.[0]?.perUnitPrice?.text || '');
        products[index] = {
          ...product,
          name: detail.cName || product.name,
          navUsd: Number(detail.newPrice),
          distributionUsd: Number.isFinite(distribution) ? distribution : product.distributionUsd,
          currency: detail.newPriceCurrency || product.currency,
          dataDate: detail.newPriceDate || product.dataDate,
          dividendDate: dividend?.lastTime?.list?.[0]?.exDividendDate?.text || product.dividendDate
        };
      }
      successCount += 1;
    } catch { /* 沿用已儲存資料 */ }
  }));
  saveProducts();
  renderAllocationRows();
  calculateAndRender();
  $('fundStatus').textContent = successCount === products.length
    ? `${products.length}檔基金均已更新；最新淨值日介於 ${apiDateToRoc(products.reduce((latest, p) => p.dataDate > latest ? p.dataDate : latest, ''))} 前後。`
    : `已更新 ${successCount}檔，其餘沿用已儲存資料。`;
  button.disabled = false;
}

async function refreshFx() {
  const button = $('refreshFxBtn');
  button.disabled = true;
  $('fxStatus').textContent = '正在更新臺灣銀行美元即期匯率…';
  try {
    const response = await fetch(BOT_RATE_MIRROR, { cache: 'no-store' });
    if (!response.ok) throw new Error('臺銀匯率資料服務無回應');
    const data = await response.json();
    const buy = Number(data?.details?.USD?.spot?.buy);
    const sell = Number(data?.details?.USD?.spot?.sell);
    if (!(buy > 0) || !(sell > 0)) throw new Error('找不到臺銀美元即期匯率');
    $('purchaseFxRate').value = sell.toFixed(4);
    $('dividendFxRate').value = buy.toFixed(4);
    const saved = { buy, sell, updatedAt: data.sourcePublishedAt || data.fetchedAt || new Date().toISOString() };
    localStorage.setItem(FX_KEY, JSON.stringify(saved));
    $('fxStatus').textContent = `賣出 ${sell.toFixed(4)}／買入 ${buy.toFixed(4)}；牌告日 ${formatRocDate(new Date(saved.updatedAt))}`;
    calculateAndRender();
  } catch (error) {
    const cached = JSON.parse(localStorage.getItem(FX_KEY) || 'null');
    if (cached?.buy && cached?.sell) {
      $('purchaseFxRate').value = Number(cached.sell).toFixed(4);
      $('dividendFxRate').value = Number(cached.buy).toFixed(4);
      $('fxStatus').textContent = `目前離線，沿用 ${formatRocDate(new Date(cached.updatedAt))} 匯率`;
      calculateAndRender();
    } else {
      $('fxStatus').textContent = '無法自動取得，請手動輸入臺銀即期賣出及買入匯率';
    }
  } finally { button.disabled = false; }
}

async function renderReportCloneCanvas(report) {
  if (document.fonts?.ready) await document.fonts.ready;
  const stage = document.createElement('div');
  stage.className = 'export-stage';
  report.classList.add('export-report');
  stage.appendChild(report);
  document.body.appendChild(stage);
  try {
    return await window.html2canvas(report, {
      scale: 2,
      backgroundColor: '#fffdf9',
      useCORS: true,
      logging: false,
      width: 1080,
      windowWidth: 1080,
      scrollX: 0,
      scrollY: 0
    });
  } finally {
    stage.remove();
  }
}

async function renderCustomerReportCanvas() {
  return renderReportCloneCanvas($('report').cloneNode(true));
}

async function renderCustomerPdfCanvases() {
  const itemCount = document.querySelectorAll('#report .report-fund-card').length;
  const groups = createReportPageGroups(itemCount);
  const canvases = [];
  for (let pageIndex = 0; pageIndex < groups.length; pageIndex += 1) {
    const report = $('report').cloneNode(true);
    const included = new Set(groups[pageIndex]);
    report.querySelectorAll('.report-fund-card').forEach((card, index) => {
      if (!included.has(index)) card.remove();
    });
    report.querySelector('.fund-breakdown-head span').textContent = groups.length > 1
      ? `第${pageIndex + 1}／${groups.length}頁`
      : '每月現金流規劃';
    if (pageIndex > 0) {
      report.querySelector('.hero-result')?.remove();
      report.querySelector('.summary-grid')?.remove();
      report.querySelector('.report-head h2').textContent = '投資組合配置試算（續）';
    }
    if (pageIndex < groups.length - 1) {
      report.querySelector('.portfolio-total')?.remove();
      report.querySelector('.rate-row')?.remove();
      report.querySelector('.disclaimer')?.remove();
    }
    canvases.push(await renderReportCloneCanvas(report));
  }
  return canvases;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('無法建立輸出檔案')), type, quality));
}

async function shareOrDownload(blob, filename, title) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function exportImage() {
  const button = $('exportImageBtn');
  button.disabled = true;
  button.textContent = '產生客戶版照片…';
  try {
    const canvas = await renderCustomerReportCanvas();
    const blob = await canvasToBlob(canvas, 'image/png');
    await shareOrDownload(blob, `月配息規劃_${localIsoDate()}.png`, '月配息規劃試算');
  } catch (error) {
    $('errorMessage').textContent = `照片輸出失敗：${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = '輸出照片';
  }
}

async function exportPdf() {
  const button = $('printBtn');
  button.disabled = true;
  button.textContent = '產生客戶版 PDF…';
  try {
    if (!window.jspdf?.jsPDF) throw new Error('PDF元件尚未載入');
    const canvases = await renderCustomerPdfCanvases();
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    canvases.forEach((canvas, index) => {
      if (index > 0) pdf.addPage('a4', 'landscape');
      const image = canvas.toDataURL('image/jpeg', 0.94);
      const layout = createContainedPdfLayout({ canvasWidth: canvas.width, canvasHeight: canvas.height });
      pdf.addImage(image, 'JPEG', layout.xMm, layout.yMm, layout.imageWidthMm, layout.imageHeightMm, undefined, 'FAST');
    });
    const blob = pdf.output('blob');
    await shareOrDownload(blob, `月配息規劃_${localIsoDate()}.pdf`, '月配息規劃試算');
  } catch (error) {
    $('errorMessage').textContent = `PDF輸出失敗：${error.message}`;
  } finally {
    button.disabled = false;
    button.textContent = '輸出 PDF';
  }
}

$('allocationRows').addEventListener('focusin', event => {
  if (event.target.classList.contains('allocation-percent-input')) event.target.select();
});
$('allocationRows').addEventListener('change', event => {
  const row = event.target.closest('.allocation-row');
  if (!row) return;
  const allocation = allocations.find(item => item.rowId === row.dataset.rowId);
  if (event.target.classList.contains('allocation-product')) allocation.productId = event.target.value;
  if (event.target.classList.contains('allocation-percent-input')) allocation.percent = Number(event.target.value);
  renderAllocationRows();
  calculateAndRender();
});
$('allocationRows').addEventListener('input', event => {
  if (!event.target.classList.contains('allocation-percent-input')) return;
  const row = event.target.closest('.allocation-row');
  const allocation = allocations.find(item => item.rowId === row.dataset.rowId);
  allocation.percent = Number(event.target.value);
  calculateAndRender();
});
$('allocationRows').addEventListener('click', event => {
  const button = event.target.closest('.remove-allocation');
  if (button) removeAllocation(button.closest('.allocation-row').dataset.rowId);
});
$('openAllocationBtn').addEventListener('click', () => $('allocationDialog').showModal());
$('addAllocationBtn').addEventListener('click', addAllocation);
$('refreshFundsBtn').addEventListener('click', refreshAllFunds);
$('refreshFxBtn').addEventListener('click', refreshFx);
$('existingCustomerBtn').addEventListener('click', () => {
  existingCustomer = !existingCustomer;
  $('existingCustomerBtn').setAttribute('aria-pressed', String(existingCustomer));
  updateFeeRate();
});
$('feePlan').addEventListener('change', updateFeeControls);
$('policyYear').addEventListener('change', updateFeeRate);
$('paymentType').addEventListener('change', updateFeeRate);
$('feeBasisAmount').addEventListener('input', updateFeeRate);
$('feeCurrency').addEventListener('change', () => {
  syncFeeBasisFromInvestment();
  updateFeeRate();
});
$('amountTwd').addEventListener('input', () => {
  syncFeeBasisFromInvestment();
  updateFeeRate();
});
['purchaseFxRate', 'dividendFxRate'].forEach(id => $(id).addEventListener('input', calculateAndRender));
$('exportImageBtn').addEventListener('click', exportImage);
$('printBtn').addEventListener('click', exportPdf);

renderAllocationRows();
updateFeeControls();
refreshFx();
refreshAllFunds();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js');
