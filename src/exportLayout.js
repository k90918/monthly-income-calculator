export function createReportPageGroups(itemCount, firstPageSize = 2, nextPageSize = 3) {
  if (!Number.isInteger(itemCount) || itemCount < 1) throw new Error('報告至少需要1檔標的');
  const groups = [];
  let index = 0;
  while (index < itemCount) {
    const size = groups.length === 0 ? firstPageSize : nextPageSize;
    groups.push(Array.from({ length: Math.min(size, itemCount - index) }, (_, offset) => index + offset));
    index += size;
  }
  return groups;
}

export function createContainedPdfLayout({ canvasWidth, canvasHeight, pageWidthMm = 297, pageHeightMm = 210, marginMm = 10 }) {
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) throw new Error('報告畫布尺寸無效');
  const maxWidthMm = pageWidthMm - marginMm * 2;
  const maxHeightMm = pageHeightMm - marginMm * 2;
  const scale = Math.min(maxWidthMm / canvasWidth, maxHeightMm / canvasHeight);
  const imageWidthMm = canvasWidth * scale;
  const imageHeightMm = canvasHeight * scale;
  return {
    imageWidthMm,
    imageHeightMm,
    xMm: (pageWidthMm - imageWidthMm) / 2,
    yMm: (pageHeightMm - imageHeightMm) / 2,
    pageCount: 1
  };
}

export function createPdfLayout({ canvasWidth, canvasHeight, pageWidthMm = 210, pageHeightMm = 297, marginMm = 10 }) {
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) throw new Error('報告畫布尺寸無效');
  const imageWidthMm = pageWidthMm - marginMm * 2;
  const contentHeightMm = pageHeightMm - marginMm * 2;
  const imageHeightMm = canvasHeight * imageWidthMm / canvasWidth;
  const pageCount = Math.max(1, Math.ceil(imageHeightMm / contentHeightMm));
  const pageOffsetsMm = Array.from({ length: pageCount }, (_, index) => index * contentHeightMm);
  return { imageWidthMm, imageHeightMm, contentHeightMm, pageCount, pageOffsetsMm };
}
