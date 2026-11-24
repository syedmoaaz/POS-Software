import { formatMoney } from "@mms/shared";

const PAPER_WIDTH_KEY = "mms-paper-width";
const PRINT_METHOD_KEY = "mms-print-method";

export const RECEIPT_STORE = {
  name: "AR Mart",
  phone: "03128740165",
  address: "Defence View Road, Karachi",
  poweredBy: "Software Powered by Master Solutions",
};

export type PrintMethod = "browser" | "bridge";

export type ReceiptPrintItem = {
  name: string;
  qty: number;
  unitPriceMinor: number;
  discountMinor?: number;
  lineTotalMinor: number;
};

export type ReceiptPrintInput = {
  storeName?: string;
  storePhone?: string;
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
  poweredBy?: string;
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
  const storeName = input.storeName || RECEIPT_STORE.name;
  const storePhone = input.storePhone || RECEIPT_STORE.phone;
  const storeAddress = input.storeAddress || RECEIPT_STORE.address;
  const poweredBy = input.poweredBy || RECEIPT_STORE.poweredBy;
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
        font-family: Arial, Helvetica, sans-serif;
        font-size: ${paperWidthMm === 58 ? "13px" : "14px"};
        font-weight: 700;
        line-height: 1.4;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
        color-adjust: exact;
        -webkit-text-stroke: 0.35px #000;
        text-shadow: 0.25px 0 0 #000, -0.25px 0 0 #000;
      }
      .wrap { padding: 4mm 3mm 8mm; }
      .center { text-align: center; }
      .store {
        font-size: ${paperWidthMm === 58 ? "20px" : "22px"};
        font-weight: 900;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        -webkit-text-stroke: 0.6px #000;
      }
      .phone { font-size: ${paperWidthMm === 58 ? "14px" : "16px"}; font-weight: 900; margin-top: 3px; }
      .addr { margin-top: 2px; font-weight: 700; }
      .row { display: flex; justify-content: space-between; gap: 8px; font-weight: 700; }
      .row span:first-child { overflow-wrap: anywhere; }
      .sep { border-top: 2px solid #000; margin: 8px 0; }
      .bold { font-weight: 900; font-size: ${paperWidthMm === 58 ? "15px" : "16px"}; }
      .muted { font-size: ${paperWidthMm === 58 ? "12px" : "13px"}; font-weight: 700; color: #000; }
      .brand { margin-top: 8px; font-size: ${paperWidthMm === 58 ? "11px" : "12px"}; font-weight: 800; }
      @media print {
        html, body { width: ${paperWidthMm}mm; color: #000 !important; }
        .wrap { padding-bottom: 10mm; }
      }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="center">
        <div class="store">${esc(storeName)}</div>
        <div class="phone">${esc(storePhone)}</div>
        <div class="addr">${esc(storeAddress)}</div>
        <div class="bold" style="margin-top:8px">${esc(input.receiptNo)}</div>
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
      <div class="center brand">${esc(poweredBy)}</div>
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
    },
    paperWidthMm,
  );
}
