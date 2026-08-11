/** Minimal ESC/POS builders for 58/80mm thermal printers. */

const ESC = 0x1b;
const GS = 0x1d;

function encodeText(text: string): Buffer {
  return Buffer.from(text, "utf8");
}

export type ReceiptLine =
  | { kind: "text"; text: string; align?: "left" | "center" | "right"; bold?: boolean }
  | { kind: "separator" }
  | { kind: "feed"; lines?: number }
  | { kind: "cut" };

export type ReceiptPayload = {
  paperWidthMm?: 58 | 80;
  storeName?: string;
  lines?: ReceiptLine[];
  footer?: string;
  /** Structured sale fallback when `lines` omitted */
  receiptNo?: string;
  soldAt?: string;
  items?: Array<{ name: string; qty: number; unitPriceMinor: number; lineTotalMinor: number }>;
  totals?: {
    subtotalMinor?: number;
    discountMinor?: number;
    taxMinor?: number;
    totalMinor?: number;
    paidMinor?: number;
    changeMinor?: number;
  };
  payments?: Array<{ method: string; amountMinor: number }>;
};

function money(minor: number) {
  return `PKR ${(minor / 100).toFixed(2)}`;
}

function charsForWidth(mm: 58 | 80) {
  return mm === 58 ? 32 : 48;
}

function padRow(left: string, right: string, width: number) {
  const space = Math.max(1, width - left.length - right.length);
  return left.slice(0, width - right.length - 1) + " ".repeat(space) + right;
}

export function buildReceipt(payload: ReceiptPayload): Buffer {
  const widthMm = payload.paperWidthMm === 58 ? 58 : 80;
  const width = charsForWidth(widthMm);
  const chunks: Buffer[] = [];

  const push = (...bufs: Buffer[]) => chunks.push(...bufs);
  const cmd = (...bytes: number[]) => Buffer.from(bytes);

  push(cmd(ESC, 0x40)); // init
  push(cmd(ESC, 0x61, 0x01)); // center
  push(cmd(ESC, 0x45, 0x01)); // bold
  push(encodeText(`${payload.storeName ?? "Mega Modern POS"}\n`));
  push(cmd(ESC, 0x45, 0x00));
  push(cmd(ESC, 0x61, 0x00)); // left

  if (payload.lines?.length) {
    for (const line of payload.lines) {
      if (line.kind === "separator") {
        push(encodeText(`${"-".repeat(width)}\n`));
      } else if (line.kind === "feed") {
        push(cmd(ESC, 0x64, line.lines ?? 1));
      } else if (line.kind === "cut") {
        push(cmd(GS, 0x56, 0x00));
      } else {
        const align = line.align === "center" ? 1 : line.align === "right" ? 2 : 0;
        push(cmd(ESC, 0x61, align));
        if (line.bold) push(cmd(ESC, 0x45, 0x01));
        push(encodeText(`${line.text}\n`));
        if (line.bold) push(cmd(ESC, 0x45, 0x00));
        push(cmd(ESC, 0x61, 0x00));
      }
    }
  } else {
    if (payload.receiptNo) push(encodeText(`Receipt: ${payload.receiptNo}\n`));
    if (payload.soldAt) push(encodeText(`${new Date(payload.soldAt).toLocaleString()}\n`));
    push(encodeText(`${"-".repeat(width)}\n`));
    for (const item of payload.items ?? []) {
      push(encodeText(`${item.name}\n`));
      push(
        encodeText(
          `${padRow(`${item.qty} x ${money(item.unitPriceMinor)}`, money(item.lineTotalMinor), width)}\n`,
        ),
      );
    }
    push(encodeText(`${"-".repeat(width)}\n`));
    const t = payload.totals ?? {};
    if (t.subtotalMinor != null) {
      push(encodeText(`${padRow("Subtotal", money(t.subtotalMinor), width)}\n`));
    }
    if (t.discountMinor) {
      push(encodeText(`${padRow("Discount", money(t.discountMinor), width)}\n`));
    }
    if (t.taxMinor) {
      push(encodeText(`${padRow("Tax", money(t.taxMinor), width)}\n`));
    }
    push(cmd(ESC, 0x45, 0x01));
    push(encodeText(`${padRow("TOTAL", money(t.totalMinor ?? 0), width)}\n`));
    push(cmd(ESC, 0x45, 0x00));
    for (const p of payload.payments ?? []) {
      push(encodeText(`${padRow(p.method, money(p.amountMinor), width)}\n`));
    }
    if (t.changeMinor) {
      push(encodeText(`${padRow("Change", money(t.changeMinor), width)}\n`));
    }
  }

  push(cmd(ESC, 0x61, 0x01));
  push(encodeText(`\n${payload.footer ?? "Thank you for shopping"}\n\n`));
  push(cmd(ESC, 0x61, 0x00));
  push(cmd(ESC, 0x64, 3));
  push(cmd(GS, 0x56, 0x00)); // full cut

  return Buffer.concat(chunks);
}

export function buildTestPage(paperWidthMm: 58 | 80 = 80): Buffer {
  return buildReceipt({
    paperWidthMm,
    storeName: "Mega Modern Solutions POS",
    lines: [
      { kind: "text", text: "PRINT BRIDGE TEST", align: "center", bold: true },
      { kind: "separator" },
      { kind: "text", text: `Paper: ${paperWidthMm}mm` },
      { kind: "text", text: `Time: ${new Date().toISOString()}` },
      { kind: "text", text: "If you can read this, ESC/POS OK." },
      { kind: "feed", lines: 2 },
    ],
    footer: "Bridge online",
  });
}

/** Standard cash drawer kick (pin 2). */
export function buildDrawerKick(): Buffer {
  // ESC p m t1 t2 — m=0 (pin2), t1/t2 pulse
  return Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]);
}
