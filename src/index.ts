import { ALLOWED, cachePolicy } from './cachePolicy'
import { upstreamHeaders } from './upstream'
import { signTasoUrl } from './sign'
import { takeBudget, type BudgetNs } from './budget'
export { UpstreamBudget } from './budget'
import { localRateLimited, originAllowed, validateParams } from './guards'

type Sport = 'spl' | 'ssbl' | 'basket' | 'volley'

type Env = {
    TASO_BASE?: string
    TASO_REFERER?: string
    TASO_ACCEPT?: string
    SPL_BASE?: string
    SPL_REFERER?: string
    SPL_ACCEPT?: string
    SSBL_BASE?: string
    SSBL_REFERER?: string
    SSBL_ACCEPT?: string
    BASKET_BASE?: string
    BASKET_REFERER?: string
    BASKET_ACCEPT?: string
    VOLLEY_BASE?: string
    VOLLEY_REFERER?: string
    VOLLEY_ACCEPT?: string
    UPSTREAM_BUDGET?: BudgetNs
    UPSTREAM_CAP_PER_MIN?: string
    RATE_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> }
}

const DEFAULTS: Record<Sport, { base: string; referer: string; accept: string }> = {
    spl: {
        base: 'https://spl.torneopal.net/taso/rest/',
        referer: 'https://tulospalvelu.palloliitto.fi/',
        accept: 'json/4h7dznqdxwtp3hsfdyf5r793uahfxy7x',
    },
    ssbl: {
        base: 'https://salibandy-api.torneopal.net/taso/rest/',
        referer: 'https://tulospalvelu.salibandy.fi/',
        accept: 'json/zsn3anknxzcfzc23k53jqdcd4pymutsf',
    },
    basket: {
        base: 'https://koripallo-api.torneopal.net/taso/rest/',
        referer: 'https://tulospalvelu.basket.fi/',
        accept: 'json/df8e84j9xtdz269euy3h',
    },
    volley: {
        base: 'https://lentopallo-api.torneopal.net/taso/rest/',
        referer: 'https://tulospalvelu.lentopallo.fi/',
        accept: 'json/df8e84j9xtdz269euy3h',
    },
}

function cors(res: Response, origin: string | null = null): Response {
    const h = new Headers(res.headers)
    if (origin && originAllowed(origin)) {
        h.set('Access-Control-Allow-Origin', origin)
        h.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
        h.set('Access-Control-Allow-Headers', 'Accept, Content-Type')
        h.set('Access-Control-Expose-Headers', 'X-Taso-Cache, X-Taso-Hit, X-Taso-Sport')
    }
    h.set('Vary', 'Origin')
    return new Response(res.body, { status: res.status, headers: h })
}

function sportConfig(sport: Sport, env: Env) {
    const d = DEFAULTS[sport]
    if (sport === 'spl') {
        return {
            base: env.SPL_BASE || env.TASO_BASE || d.base,
            referer: env.SPL_REFERER || env.TASO_REFERER || d.referer,
            accept: env.SPL_ACCEPT || env.TASO_ACCEPT || d.accept,
        }
    }
    if (sport === 'ssbl') {
        return { base: env.SSBL_BASE || d.base, referer: env.SSBL_REFERER || d.referer, accept: env.SSBL_ACCEPT || d.accept }
    }
    if (sport === 'basket') {
        return { base: env.BASKET_BASE || d.base, referer: env.BASKET_REFERER || d.referer, accept: env.BASKET_ACCEPT || d.accept }
    }
    return { base: env.VOLLEY_BASE || d.base, referer: env.VOLLEY_REFERER || d.referer, accept: env.VOLLEY_ACCEPT || d.accept }
}

function parsePath(pathname: string): { sport: Sport; endpoint: string } | null {
    const parts = pathname.split('/').filter(Boolean)
    if (parts.length === 0) return null
    if (parts[0] === 'spl' || parts[0] === 'ssbl' || parts[0] === 'basket' || parts[0] === 'volley') {
        const endpoint = parts[1] || ''
        return { sport: parts[0], endpoint }
    }
    return { sport: 'spl', endpoint: parts[parts.length - 1] }
}

async function tasoFetch(target: URL, referer: string, accept: string): Promise<{ status: number; raw: string; mitigated: string }> {
    const signed = await signTasoUrl(target)
    const upstream = await fetch(signed.toString(), {
        headers: upstreamHeaders(referer, accept),
        cf: {
            cacheEverything: false,
            cacheTtlByStatus: { '200-299': 120, '400-599': 0 },
        },
    } as RequestInit)
    const raw = await upstream.text()
    return { status: upstream.status, raw, mitigated: upstream.headers.get('cf-mitigated') || '' }
}

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        const origin = req.headers.get('Origin')
        const res = await handle(req, env, origin)
        return cors(res, origin)
    },
}

const RATE_LIMIT_PER_MIN = 120

const json = (body: unknown, status: number, cc = 'no-store') =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cc } })

async function handle(req: Request, env: Env, origin: string | null): Promise<Response> {
    if (!originAllowed(origin)) return json({ error: 'origin' }, 403)
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Max-Age': '86400' } })
    if (req.method !== 'GET') return new Response('method', { status: 405 })

    const url = new URL(req.url)
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, service: 'taso-proxy' }, 200)

    const parsed = parsePath(url.pathname)
    if (!parsed || !ALLOWED.has(parsed.endpoint)) return new Response('endpoint', { status: 400 })
    const { sport, endpoint } = parsed
    const bad = validateParams(endpoint, url.searchParams)
    if (bad) return json({ error: 'params', detail: bad }, 400)

    const ip = req.headers.get('CF-Connecting-IP') || 'unknown'
    const limited = env.RATE_LIMITER
        ? !(await env.RATE_LIMITER.limit({ key: ip })).success
        : localRateLimited(ip, RATE_LIMIT_PER_MIN)
    if (limited) {
        const r = json({ error: 'rate_limited' }, 429)
        r.headers.set('Retry-After', '60')
        return r
    }

    const cfg = sportConfig(sport, env)

    if (endpoint === 'tournamentWidget') {
        const host = url.searchParams.get('host') || 'vierumaki-turnaus5-2026.torneopal.fi'
        if (!/^[a-z0-9\-.]+\.torneopal\.(fi|net)$/i.test(host)) return new Response('invalid host', { status: 400 })
        const targetUrl = new URL(`https://${host}/taso/widget.php`)
        url.searchParams.forEach((v, k) => {
            if (k !== 'host') targetUrl.searchParams.set(k, v)
        })
        const upstream = await fetch(targetUrl.toString(), {
            headers: {
                Referer: `https://${host}/`,
                'User-Agent':
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
            },
        })
        return new Response(await upstream.text(), {
            status: upstream.status,
            headers: {
                'Content-Type': 'text/javascript; charset=utf-8',
                'Cache-Control': upstream.ok ? 'public, max-age=120, stale-while-revalidate=600' : 'no-store',
            },
        })
    }

    const taso = new URL(`${cfg.base.replace(/\/$/, '/')}${endpoint}`)
    url.searchParams.forEach((v, k) => {
        if (k !== '_cb' && k !== 'hash') taso.searchParams.set(k, v)
    })

    const cache = caches.default
    const cacheKey = new Request(taso.toString(), { method: 'GET' })
    const hit = await cache.match(cacheKey)
    if (hit) {
        const h = new Response(hit.body, hit)
        h.headers.set('X-Taso-Hit', 'HIT')
        return h
    }

    // Stale copy: same body kept 7 days under a separate key, served only when over the global cap.
    const staleKey = new Request(`${taso.toString()}${taso.search ? '&' : '?'}__stale=1`, { method: 'GET' })
    const cap = Number(env.UPSTREAM_CAP_PER_MIN) || 60
    if (!(await takeBudget(env.UPSTREAM_BUDGET, sport, cap))) {
        const stale = await cache.match(staleKey)
        if (stale) {
            const h = new Response(stale.body, stale)
            h.headers.set('X-Taso-Hit', 'STALE')
            h.headers.set('Cache-Control', 'no-store')
            return h
        }
        const r = json({ call: { status: 'error', http: 429 }, error: 'upstream_budget', cap_per_min: cap, sport }, 429)
        r.headers.set('Retry-After', '60')
        r.headers.set('X-Taso-Hit', 'BUDGET')
        return r
    }

    // Exactly one upstream call per miss: no cache-bust retry (it doubled load on the federation).
    const { status, raw, mitigated } = await tasoFetch(taso, cfg.referer, cfg.accept)
    const ok = status >= 200 && status < 300
    const policy = ok ? cachePolicy(endpoint, raw) : { cc: 'no-store', name: `bypass-${status}`, store: false }
    const valid = ok && policy.name !== 'bypass-invalid'

    // Never leak origin 403 as HTTP 403 — the browser paints it red and the client
    // already falls back to origin. Return a JSON error envelope instead.
    const outBody = valid || (ok && raw.indexOf('{') >= 0)
        ? raw
        : JSON.stringify({ call: { status: 'error', http: status }, error: 'upstream', mitigated: mitigated || undefined })

    const out = new Response(outBody, {
        status: 200,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': policy.cc,
            'CDN-Cache-Control': policy.cc,
            'X-Taso-Cache': policy.name,
            'X-Taso-Sport': sport,
            'X-Taso-Hit': 'MISS',
        },
    })
    if (valid && policy.store && policy.cc !== 'no-store') {
        await cache.put(cacheKey, out.clone())
        const st = out.clone()
        const sh = new Response(st.body, st)
        sh.headers.set('Cache-Control', 'public, max-age=604800')
        sh.headers.delete('CDN-Cache-Control')
        await cache.put(staleKey, sh)
    }
    return out
}
