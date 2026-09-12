# AGENTS.md — The Rule of taso-proxy

The canonical rule for this monastery. Shared Torneopal edge cache for the sports federation.

## §0 Precedence
1. `AGENTS.md` (this file) is the supreme project rule.
2. Native tool configs are thin pointers to this file.

## §1 Identity
- Cloudflare Worker `taso-proxy` at `https://taso-proxy.sakkoja.workers.dev`.
- Routes: `/spl`, `/ssbl`, `/basket`, `/volley` plus legacy `/getMatch` (SPL).
- CORS + cache for four Pages houses. Not a UI. Not the kattorepo.

## §2 Non-negotiables

| Use | Never |
|---|---|
| Cache live matches `no-store` | Cache ongoing games |
| Upcoming getMatch max-age 30s | Cache lineups for minutes |
| Played getMatch immutable | Re-fetch finished scores as live |
| Bypass origin 403 / empty JSON | Store poisoned 4xx |
| Public TASO Accept keys in wrangler vars | GitHub secrets for TASO keys |

## §3 Cache law
- Live (status or clock `'`): `Cache-Control: no-store`. Do not `cache.put`.
- Upcoming / fixture: `max-age=30`. Do not store in Cache API.
- Played: `max-age=31536000, immutable` and Cache API `X-Taso-Cache: store-played`.
- Roster (`getTeam` / `getPlayer` / `getGroup`): 60s, not stored.
- Catalog: 300s SWR. 4xx: `no-store`.

## §4 Testing
- `npm test` covers phase + cachePolicy.
- `npm run visit` runs tests then `scripts/check-neighbors.mjs`.
- Do not add Pages, KV, D1, or R2 here.

## §5 Neighbors
- Provides edge cache to football-stats, floorball-stats, basketball-stats, volleyball-stats.
- Keep Worker **name** `taso-proxy` so the URL does not change.
- Git-connect this repo to the existing Worker. Do not create a second Worker.

## §6 Visitation
Author does not audit their own change. Verdicts: PASS · PASS WITH FINDINGS · BLOCK.
