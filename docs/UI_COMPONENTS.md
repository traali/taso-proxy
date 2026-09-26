# taso-proxy — no UI

Status: **catalog 2026-09-26**. This repo has **no** component and no page.

It is the Cloudflare Worker in front of Torneopal TASO.

| Path | Origin |
|---|---|
| `/spl/` | Palloliitto |
| `/ssbl/` | Salibandyliitto |
| `/basket/` | Basket.fi |
| `/volley/` | Lentopallo |

Live: https://taso-proxy.sakkoja.workers.dev

Do not send an `Origin` header upstream. That 403'd the worker. Screens that show a court, a table, or a score get those strings from this proxy or from the federation origin. They must not invent a row when the proxy is empty.

The screens are documented in basketball-stats, floorball-stats, football-stats, and volleyball-stats under `docs/UI_COMPONENTS.md`.
