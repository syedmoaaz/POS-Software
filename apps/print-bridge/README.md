# Print Bridge

Local ESC/POS agent for Mega Modern Solutions POS.

Runs on `127.0.0.1` so the browser can talk to store printers/drawers that browsers cannot drive directly.

## Run

```bash
pnpm --filter @mms/print-bridge dev
```

Default: **simulate** mode (writes raw ESC/POS bytes under `apps/print-bridge/.output/`).

For a network thermal printer:

```bash
BRIDGE_MODE=network PRINTER_HOST=192.168.1.50 PRINTER_PORT=9100 pnpm --filter @mms/print-bridge start
```

## Auth

Send header `X-Bridge-Token: <BRIDGE_TOKEN>` (default `mms-dev-bridge-token`).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness (no auth) |
| GET | `/status` | Mode + recent jobs |
| POST | `/print` | Receipt / label / test |
| POST | `/test` | Test page (58/80mm) |
| POST | `/drawer/open` | Cash drawer kick |
| GET | `/jobs` | Recent jobs |
| GET | `/jobs/:id` | Job status |

## Paper widths

- `58` mm (~32 chars)
- `80` mm (~48 chars)
