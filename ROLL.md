## 2026-09-12 — Origin 403 not leaked to the browser
- **Office / Author:** Cellarer
- **Verdict:** PASS
- **Summary:** getGroup retries without `matches=1`. Upstream 403 becomes JSON `{call.status:error}` HTTP 200 so houses fall back to origin without a red console 403.

## 2026-09-12 — Git-connected deploy
- **Office / Author:** Cellarer
- **Verdict:** PASS
- **Summary:** Worker is Git-connected to `traali/taso-proxy`. Push to `main` runs `npx wrangler deploy`. Name/URL unchanged.

## 2026-09-12 — House founded
- **Office / Author:** Master of Works
- **Verdict:** PASS
- **Summary:** Extracted from `traali/football-stats/workers/taso-proxy`. Worker name and URL unchanged. Cache law: live no-store, upcoming 30s, played immutable.
