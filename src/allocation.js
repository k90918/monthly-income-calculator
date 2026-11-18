export function createAllocationRowId({ randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto), now = Date.now, random = Math.random } = {}) {
  if (typeof randomUUID === 'function') return randomUUID();
  const randomPart = Math.floor(random() * 0x100000000).toString(16).padStart(8, '0');
  return `row-${now().toString(36)}-${randomPart}`;
}

export function createInitialAllocation(productId, rowId) {
  if (!productId) throw new Error('需要基金代碼');
  return { rowId, productId, percent: 100 };
}

export function equalAllocationPercents(count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('標的數量至少為1');
  const base = Math.floor(10000 / count) / 100;
  const result = Array.from({ length: count }, () => base);
  const used = base * (count - 1);
  result[count - 1] = Number((100 - used).toFixed(2));
  return result;
}
