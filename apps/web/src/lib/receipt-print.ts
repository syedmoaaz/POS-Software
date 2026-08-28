import { formatMoney } from "@mms/shared";

const PAPER_WIDTH_KEY = "mms-paper-width";
const PRINT_METHOD_KEY = "mms-print-method";

export type PrintMethod = "browser" | "bridge";

export type ReceiptPrintItem = {
  name: string;
  qty: number;
  unitPriceMinor: number;
  discountMinor?: number;
  lineTotalMinor: number;
};

export type ReceiptPrintInput = {
  storeName: string;
  storeAddress?: string;
  registerName?: string;
  receiptNo: string;
  soldAt: string;
  customerName?: string;
  items: ReceiptPrintItem[];
  totals: {
    subtotalMinor: number;
    discountMinor: number;
    taxMinor: number;
    totalMinor: number;
    changeMinor: number;
  };
  payments: Array<{ method: string; amountMinor: number }>;
  footer?: string;
  logoUrl?: string;
};

export function getPaperWidthMm(): 58 | 80 {
  return localStorage.getItem(PAPER_WIDTH_KEY) === "58" ? 58 : 80;
}

export function setPaperWidthMm(mm: 58 | 80) {
  localStorage.setItem(PAPER_WIDTH_KEY, String(mm));
}

export function getPrintMethod(): PrintMethod {
  return localStorage.getItem(PRINT_METHOD_KEY) === "bridge" ? "bridge" : "browser";
}

export function setPrintMethod(method: PrintMethod) {
  localStorage.setItem(PRINT_METHOD_KEY, method);
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReceiptHtml(input: ReceiptPrintInput, paperWidthMm: 58 | 80) {
  const logoSrc = input.logoUrl
    ? input.logoUrl.startsWith("http")
      ? input.logoUrl
      : `${window.location.origin}${input.logoUrl.startsWith("/") ? "" : "/"}${input.logoUrl}`
    : `${window.location.origin}/logo.jpeg`;
  const when = input.soldAt ? new Date(input.soldAt).toLocaleString() : new Date().toLocaleString();
  const itemRows = input.items
    .map((item) => {
      const qtyLabel = Number.isInteger(item.qty) ? String(item.qty) : item.qty.toFixed(3);
      return `<div class="row"><span>${esc(qtyLabel)} × ${esc(item.name)}</span><span>${esc(formatMoney(item.lineTotalMinor))}</span></div>`;
    })
    .join("");
  const paymentRows = input.payments
    .map(
      (p) =>
        `<div class="row"><span>${esc(p.method)}</span><span>${esc(formatMoney(p.amountMinor))}</span></div>`,
    )
    .join("");
  const address = input.storeAddress ? `<div>${esc(input.storeAddress)}</div>` : "";
  const register = input.registerName ? `<div>${esc(input.registerName)}</div>` : "";
  const customer = input.customerName ? `<div>Customer: ${esc(input.customerName)}</div>` : "";
  const discount =
    input.totals.discountMinor > 0
      ? `<div class="row"><span>Discount</span><span>-${esc(formatMoney(input.totals.discountMinor))}</span></div>`
      : "";
  const tax =
    input.totals.taxMinor > 0
      ? `<div class="row"><span>Tax</span><span>${esc(formatMoney(input.totals.taxMinor))}</span></div>`
      : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${esc(input.receiptNo)}</title>
    <style>
      @page { size: ${paperWidthMm}mm auto; margin: 0; }
      * { box-sizing: border-box; }
      html, body {
        width: ${paperWidthMm}mm;
        margin: 0;
        padding: 0;
        background: #fff;
        color: #000;
        font-family: "Courier New", ui-monospace, Consolas, monospace;
        font-size: ${paperWidthMm === 58 ? "11px" : "12px"};
        line-height: 1.35;
      }
      .wrap { padding: 4mm 3mm 8mm; }
      .center { text-align: center; }
      .logo { height: 48px; width: 48px; object-fit: contain; }
      .store { font-size: ${paperWidthMm === 58 ? "13px" : "15px"}; font-weight: 800; letter-spacing: 0.02em; }
      .row { display: flex; justify-content: space-between; gap: 8px; }
      .row span:first-child { overflow-wrap: anywhere; }
      .sep { border-top: 1px dashed #000; margin: 8px 0; }
      .bold { font-weight: 700; }
      .muted { font-size: 10px; }
      @media print {
        html, body { width: ${paperWidthMm}mm; }
        .wrap { padding-bottom: 10mm; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="center">
        <img class="logo" src="${esc(logoSrc)}" alt="" onerror="this.style.display='none'" />
        <div class="store">${esc(input.storeName)}</div>
        ${address}
        ${register}
        <div class="bold" style="margin-top:6px">${esc(input.receiptNo)}</div>
        <div class="muted">${esc(when)}</div>
        ${customer}
      </div>
      <div class="sep"></div>
      ${itemRows || `<div class="center muted">No line items</div>`}
      <div class="sep"></div>
      <div class="row"><span>Subtotal</span><span>${esc(formatMoney(input.totals.subtotalMinor))}</span></div>
      ${discount}
      ${tax}
      <div class="row bold"><span>TOTAL</span><span>${esc(formatMoney(input.totals.totalMinor))}</span></div>
      ${paymentRows}
      <div class="row"><span>Change</span><span>${esc(formatMoney(input.totals.changeMinor))}</span></div>
      <div class="sep"></div>
      <div class="center">${esc(input.footer ?? "Thank you for shopping with us")}</div>
    </div>
  </body>
</html>`;
}

function waitForImages(doc: Document) {
  const images = Array.from(doc.images);
  if (!images.length) return Promise.resolve();
  return Promise.all(
    images.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

/** Opens the browser print dialog with a thermal-sized receipt (58/80mm). */
export async function printReceiptInBrowser(input: ReceiptPrintInput, paperWidthMm = getPaperWidthMm()) {
  const html = buildReceiptHtml(input, paperWidthMm);
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  if (!win || !doc) {
    iframe.remove();
    throw new Error("Could not open print preview");
  }

  doc.open();
  doc.write(html);
  doc.close();
  await waitForImages(doc);
  await new Promise((r) => window.setTimeout(r, 150));
  win.focus();
  win.print();
  window.setTimeout(() => iframe.remove(), 1500);
}

export function printTestReceiptInBrowser(paperWidthMm = getPaperWidthMm()) {
  return printReceiptInBrowser(
    {
      storeName: "Mega Modern Solutions",
      storeAddress: "Test print",
      registerName: "Counter 1",
      receiptNo: "TEST-000000",
      soldAt: new Date().toISOString(),
      items: [
        { name: "Test item A", qty: 1, unitPriceMinor: 10000, lineTotalMinor: 10000 },
        { name: "Test item B", qty: 2, unitPriceMinor: 2500, lineTotalMinor: 5000 },
      ],
      totals: {
        subtotalMinor: 15000,
        discountMinor: 0,
        taxMinor: 0,
        totalMinor: 15000,
        changeMinor: 0,
      },
      payments: [{ method: "cash", amountMinor: 15000 }],
      footer: "Printer test page",
    },
    paperWidthMm,
  );
}
