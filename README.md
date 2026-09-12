# taso-proxy

Shared Cloudflare Worker for Torneopal / TASO. Used by football, floorball, basketball, and volleyball Pages apps.

**Live:** https://taso-proxy.sakkoja.workers.dev

| Path | Origin |
|---|---|
| `/spl/{endpoint}` | spl.torneopal.net |
| `/ssbl/{endpoint}` | salibandy-api.torneopal.net |
| `/basket/{endpoint}` | koripallo-api.torneopal.net |
| `/volley/{endpoint}` | lentopallo-api.torneopal.net |

Cache: live never stored, upcoming 30s, played immutable. Origin 403s are retried with `_cb` and not cached.

```bash
npm test
npx wrangler deploy   # Worker name stays taso-proxy
```

This used to live in `traali/football-stats/workers/taso-proxy`.
