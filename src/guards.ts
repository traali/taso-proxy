/** Origins allowed to call the proxy from a browser (Arto's house apps + local dev). */
export const PAGES_PROJECTS = [
    'pelipaiva',
    'football-stats-agk',
    'floorball-stats',
    'basketball-stats-byu',
    'volleyball-stats-7xq',
    'weather-stats',
    'parkkis',
    'sports-federation',
    'sakkoja',
]

export function originAllowed(origin: string | null): boolean {
    if (!origin) return true // non-browser (curl, health checks): no CORS header is sent back
    let u: URL
    try {
        u = new URL(origin)
    } catch {
        return false
    }
    if ((u.hostname === 'localhost' || u.hostname === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:')) return true
    if (u.protocol !== 'https:' || !u.hostname.endsWith('.pages.dev')) return false
    const labels = u.hostname.slice(0, -'.pages.dev'.length).split('.')
    const project = labels[labels.length - 1]
    // project.pages.dev or <preview>.project.pages.dev
    return labels.length <= 2 && PAGES_PROJECTS.includes(project)
}

const NUMERIC = new Set(['match_id', 'team_id', 'player_id', 'club_id', 'group_id', 'season_id', 'venue_id', 'round_id', 'official_id'])
const TOKEN = new Set(['competition_id', 'category_id', 'tournament_id', 'level_id', 'organiser', 'district_id', 'area_id'])
const DATE = new Set(['date', 'start_date', 'end_date'])
const FLAG = new Set(['matches', 'current', 'all_current', 'players', 'stats', 'details', 'lineups', 'events', 'limit', 'show_all'])
const WIDGET = new Set(['host', 'id', 'widget', 'lang', 'type', 'tournament', 'competition', 'category', 'group', 'team', 'match'])

/** Returns an error string, or null when every query param is known and well-formed. */
export function validateParams(endpoint: string, params: URLSearchParams): string | null {
    for (const [k, v] of params) {
        if (k === '_cb' || k === 'hash') continue
        if (endpoint === 'tournamentWidget' && WIDGET.has(k)) {
            if (!/^[\w\-.]{0,80}$/.test(v)) return `bad ${k}`
            continue
        }
        if (NUMERIC.has(k)) {
            if (!/^\d{1,10}$/.test(v)) return `bad ${k}`
        } else if (TOKEN.has(k)) {
            if (!/^[\w\-]{1,40}$/.test(v)) return `bad ${k}`
        } else if (DATE.has(k)) {
            if (!/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/.test(v)) return `bad ${k}`
        } else if (FLAG.has(k)) {
            if (!/^\w{0,10}$/.test(v)) return `bad ${k}`
        } else {
            return `unknown param ${k}`
        }
    }
    return null
}

/** Fixed-window per-IP counter (per isolate). Backstop when no RATE_LIMITER binding exists. */
const windows = new Map<string, { start: number; n: number }>()
export function localRateLimited(ip: string, limit = 120, windowMs = 60_000, now = Date.now()): boolean {
    const w = windows.get(ip)
    if (!w || now - w.start >= windowMs) {
        if (windows.size > 5000) windows.clear()
        windows.set(ip, { start: now, n: 1 })
        return false
    }
    w.n++
    return w.n > limit
}
