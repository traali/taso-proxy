import { ALLOWED, cachePolicy } from './cachePolicy'
import { upstreamHeaders } from './upstream'

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
        referer: 'https://lentopallo.torneopal.net/',
        accept: 'json/df8e84j9xtdz269euy3h',
    },
}

function cors(res: Response): Response {
    const h = new Headers(res.headers)
    h.set('Access-Control-Allow-Origin', '*')
    h.set('Access-Control-Allow-Methods', 'GET, OPTIONS')
    h.set('Access-Control-Allow-Headers', 'Accept, Content-Type')
    h.set('Vary', 'Accept')
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

async function tasoFetch(target: URL, referer: string, accept: string): Promise<{ status: number; raw: string }> {
    const upstream = await fetch(target.toString(), {
        headers: upstreamHeaders(referer, accept),
        cf: {
            cacheEverything: false,
            cacheTtlByStatus: { '200-299': 120, '400-599': 0 },
        },
    } as RequestInit)
    const raw = await upstream.text()
    return { status: upstream.status, raw }
}

export default {
    async fetch(req: Request, env: Env): Promise<Response> {
        if (req.method === 'OPTIONS') {
            return cors(new Response(null, { status: 204 }))
        }
        if (req.method !== 'GET') {
            return cors(new Response('method', { status: 405 }))
        }

        const url = new URL(req.url)
        if (url.pathname === '/' || url.pathname === '/health') {
            return cors(new Response(JSON.stringify({ ok: true, service: 'taso-proxy' }), {
                headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
            }))
        }

        const parsed = parsePath(url.pathname)
        if (!parsed || !ALLOWED.has(parsed.endpoint)) {
            return cors(new Response('endpoint', { status: 400 }))
        }
        const { sport, endpoint } = parsed
        const cfg = sportConfig(sport, env)

        if (endpoint === 'tournamentWidget') {
            const host = url.searchParams.get('host') || 'vierumaki-turnaus5-2026.torneopal.fi'
            if (!/^[a-z0-9\-.]+\.torneopal\.(fi|net)$/i.test(host)) {
                return cors(new Response('invalid host', { status: 400 }))
            }
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
            const raw = await upstream.text()
            return cors(
                new Response(raw, {
                    status: upstream.status,
                    headers: {
                        'Content-Type': 'text/javascript; charset=utf-8',
                        'Cache-Control': upstream.ok ? 'public, max-age=120, stale-while-revalidate=600' : 'no-store',
                    },
                }),
            )
        }

        const taso = new URL(`${cfg.base.replace(/\/$/, '/')}${endpoint}`)
        url.searchParams.forEach((v, k) => {
            if (k !== '_cb') taso.searchParams.set(k, v)
        })

        const cache = caches.default
        const cacheKey = new Request(taso.toString(), { method: 'GET' })
        if (endpoint === 'getMatch') {
            const hit = await cache.match(cacheKey)
            if (hit && hit.headers.get('X-Taso-Cache') === 'store-played') return cors(hit)
        }

        let { status, raw } = await tasoFetch(taso, cfg.referer, cfg.accept)

        if (status === 403 || !raw.trim() || raw.indexOf('{') < 0) {
            const bust = new URL(taso.toString())
            bust.searchParams.set('_cb', String(Date.now()))
            const retry = await tasoFetch(bust, cfg.referer, cfg.accept)
            status = retry.status
            raw = retry.raw
        }

        // getGroup?matches=1 is often 403 at Torneopal; standings live on getGroup without matches.
        if ((status === 403 || raw.indexOf('{') < 0) && endpoint === 'getGroup' && taso.searchParams.has('matches')) {
            const slim = new URL(taso.toString())
            slim.searchParams.delete('matches')
            slim.searchParams.set('_cb', String(Date.now()))
            const retry = await tasoFetch(slim, cfg.referer, cfg.accept)
            status = retry.status
            raw = retry.raw
        }

        const ok = status >= 200 && status < 300 && raw.indexOf('{') >= 0
        const policy = ok ? cachePolicy(endpoint, raw) : { cc: 'no-store', name: 'bypass-403', store: false }

        // Never leak origin 403 as HTTP 403 — the browser paints it red and the client
        // already falls back to origin. Return a JSON error envelope instead.
        const outStatus = ok ? status : 200
        const outBody = ok ? raw : JSON.stringify({ call: { status: 'error', http: status }, error: 'upstream' })

        const out = new Response(outBody, {
            status: outStatus,
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': policy.cc,
                'CDN-Cache-Control': policy.cc,
                'X-Taso-Cache': policy.name,
                'X-Taso-Sport': sport,
            },
        })
        if (policy.store && ok) {
            await cache.put(cacheKey, out.clone())
        }
        return cors(out)
    },
}
