/** Minimal Code128-B encoder → SVG path bars for browser label printing. */

const CODE128_B_START = 104;
const CODE128_STOP = 106;

const PATTERNS: string[] = [
  "11011001100","11001101100","11001100110","10010011000","10010001100","10001001100","10011001000","10011000100","10001100100","11001001000",
  "11001000100","11000100100","10110011100","10011011100","10011001110","10111001100","10011101100","10011100110","11001110010","11001011100",
  "11001001110","11011100100","11001110100","11101101110","11101001100","11100101100","11100100110","11101100100","11100110100","11100110010",
  "11011011000","11011000110","11000110110","10100011000","10001011000","10001000110","10110001000","10001101000","10001100010","11010001000",
  "11000101000","11000100010","10110111000","10110001110","10001101110","10111011000","10111000110","10001110110","11101110110","11010001110",
  "11000101110","11011101000","11011100010","11011101110","11101011000","11101000110","11100010110","11101101000","11101100010","11100011010",
  "11101111010","11001000010","11110001010","10100110000","10100001100","10010110000","10010000110","10000101100","10000100110","10110010000",
  "10110000100","10011010000","10011000010","10000110100","10000110010","11000010010","11001010000","11110111010","11000010100","10001111010",
  "10100111100","10010111100","10010011110","10111100100","10011110100","10011110010","11110100100","11110010100","11110010010","11011011110",
  "11011110110","11110110110","10101111000","10100011110","10001011110","10111101000","10111100010","11110101000","11110100010","10111011110",
  "10111101110","11101011110","11110101110","11010000100","11010010000","11010011100","11000111010",
];

function encodeCode128B(text: string): number[] {
  const codes = [CODE128_B_START];
  for (const ch of text) {
    const code = ch.charCodeAt(0) - 32;
    if (code < 0 || code > 95) throw new Error(`Unsupported barcode char: ${ch}`);
    codes.push(code);
  }
  let checksum = CODE128_B_START;
  for (let i = 1; i < codes.length; i++) checksum += codes[i]! * i;
  codes.push(checksum % 103);
  codes.push(CODE128_STOP);
  return codes;
}

export function barcodeSvg(code: string, opts?: { height?: number; moduleWidth?: number }) {
  const height = opts?.height ?? 48;
  const moduleWidth = opts?.moduleWidth ?? 1.5;
  const codes = encodeCode128B(code);
  let modules = "";
  for (const c of codes) modules += PATTERNS[c] ?? "";
  modules += "1100011101011"; // stop quiet termination
  let x = 0;
  const bars: string[] = [];
  for (const bit of modules) {
    if (bit === "1") {
      bars.push(`<rect x="${x}" y="0" width="${moduleWidth}" height="${height}" fill="#000"/>`);
    }
    x += moduleWidth;
  }
  const width = x;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars.join("")}</svg>`;
}

export type LabelItem = {
  name: string;
  sku?: string;
  barcode: string;
  priceMinor: number;
  attributeLine?: string;
};

function formatPkr(minor: number) {
  return `Rs ${(minor / 100).toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
}

export function buildLabelsHtml(items: LabelItem[], paperWidthMm: 40 | 50 = 50) {
  const cards = items
    .map((item) => {
      const svg = barcodeSvg(item.barcode, { height: 40, moduleWidth: 1.2 });
      return `<div class="label">
        <div class="name">${escapeHtml(item.name)}</div>
        ${item.attributeLine ? `<div class="attr">${escapeHtml(item.attributeLine)}</div>` : ""}
        <div class="bc">${svg}</div>
        <div class="code">${escapeHtml(item.barcode)}</div>
        <div class="price">${formatPkr(item.priceMinor)}</div>
        ${item.sku ? `<div class="sku">${escapeHtml(item.sku)}</div>` : ""}
      </div>`;
    })
    .join("");

  return `<!doctype html>
<html><head><title>Barcode labels</title>
<style>
  @page { margin: 4mm; size: auto; }
  body { font-family: Arial, sans-serif; margin: 0; }
  .sheet { display: flex; flex-wrap: wrap; gap: 4mm; }
  .label {
    width: ${paperWidthMm}mm;
    border: 1px dashed #ccc;
    padding: 2mm;
    text-align: center;
    page-break-inside: avoid;
  }
  .name { font-size: 11px; font-weight: 700; line-height: 1.2; }
  .attr { font-size: 9px; color: #444; margin-top: 1mm; }
  .bc { margin: 2mm 0; overflow: hidden; }
  .bc svg { max-width: 100%; height: auto; }
  .code { font-size: 9px; letter-spacing: 0.05em; }
  .price { font-size: 13px; font-weight: 800; margin-top: 1mm; }
  .sku { font-size: 8px; color: #666; }
  @media print { .label { border: none; } }
</style></head>
<body><div class="sheet">${cards}</div></body></html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Print via hidden iframe — avoids browser pop-up blockers (unlike window.open). */
export function printBarcodeLabels(items: LabelItem[], copiesPerLabel = 1) {
  const base = items.filter((i) => i.barcode);
  if (!base.length) throw new Error("No barcodes to print");
  const copies = Math.max(1, Math.min(200, Math.floor(copiesPerLabel) || 1));
  const expanded: LabelItem[] = [];
  for (const item of base) {
    for (let c = 0; c < copies; c++) expanded.push(item);
  }
  const html = buildLabelsHtml(expanded);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error("Could not open print frame");
  }
  doc.open();
  doc.write(html);
  doc.close();

  const cleanup = () => {
    setTimeout(() => iframe.remove(), 500);
  };

  const runPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  };

  // Give the browser a moment to layout SVGs before print dialog
  setTimeout(runPrint, 300);
}
