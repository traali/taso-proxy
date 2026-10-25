export const ALLOWED = new Set([
    'getMatch',
    'getGroup',
    'getGroups',
    'getTeam',
    'getPlayer',
    'getMatches',
    'getCompetitions',
    'getCategories',
    'getSeasons',
    'getClubs',
    'getClub',
    'tournamentWidget',
])

export const PLAYED = new Set(['played', 'finished', '1', 'abandoned'])
export const LIVE = new Set(['live', 'started', 'playing', 'inplay', 'in_play', 'ongoing', '2', 'interrupted'])
export const UPCOMING = new Set(['fixture', 'upcoming', 'scheduled', 'planned', '0', 'not started', 'not_started'])

export type MatchPhase = 'live' | 'upcoming' | 'played'

export function normalizeStatus(status: unknown): string {
    return String(status || '').toLowerCase().trim()
}

export function phaseOfMatch(match: { status?: unknown; time?: unknown } | undefined): MatchPhase {
    const st = normalizeStatus(match?.status)
    if (LIVE.has(st) || st.includes('live') || st.includes('inplay')) return 'live'
    if (String(match?.time || '').includes("'")) return 'live'
    if (PLAYED.has(st)) return 'played'
    if (UPCOMING.has(st) || !st) return 'upcoming'
    return 'upcoming'
}

type MatchLike = { status?: unknown; time?: unknown; date?: unknown }
type Payload = Record<string, unknown> & {
    call?: { status?: unknown }
    match?: MatchLike
    matches?: MatchLike[]
}

export function parsePayload(raw: string): Payload | null {
    const start = raw.indexOf('{')
    if (start < 0) return null
    try {
        const v = JSON.parse(raw.slice(start)) as unknown
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Payload) : null
    } catch {
        return null
    }
}

/** Which top-level object an OK answer must carry before we cache it. */
const EXPECTED: Record<string, string> = {
    getMatch: 'match',
    getMatches: 'matches',
    getTeam: 'team',
    getPlayer: 'player',
    getGroup: 'group',
    getGroups: 'groups',
    getCompetitions: 'competitions',
    getCategories: 'categories',
    getSeasons: 'seasons',
    getClubs: 'clubs',
    getClub: 'club',
}

/** True only for a parsed TASO answer with call.status ok and the expected object present. */
export function isCacheableBody(endpoint: string, data: Payload | null): boolean {
    if (!data) return false
    if (String(data.call?.status || '').toLowerCase() !== 'ok') return false
    const key = EXPECTED[endpoint]
    if (!key) return true
    const v = data[key]
    return v !== undefined && v !== null && typeof v === 'object'
}

const DAY = 86_400
const NO_STORE = { cc: 'no-store', name: 'no-store', store: false }

/** Seconds since the match day ended (Helsinki ≈ UTC+2/3; one day slack is fine). NaN when unknown. */
function ageSinceMatch(m: MatchLike | undefined, now: number): number {
    const d = String(m?.date || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return NaN
    return (now - Date.parse(`${d}T23:59:59+02:00`)) / 1000
}

function playedPolicy(age: number, name: string) {
    // First 24 h federations still correct results: 1 day. After that: 7 days. Never immutable.
    const maxAge = Number.isFinite(age) && age > DAY ? 7 * DAY : DAY
    return { cc: `public, max-age=${maxAge}, stale-while-revalidate=3600`, name, store: true }
}

/**
 * Live: never cached. Upcoming: 30s. Played: 1 day, then 7 days. Team/player/group: 15 min + SWR.
 * Catalog: 1 h + SWR. Error / empty / non-JSON bodies are never cached.
 */
export function cachePolicy(endpoint: string, raw: string, now = Date.now()): { cc: string; name: string; store: boolean } {
    const data = parsePayload(raw)
    if (!isCacheableBody(endpoint, data)) return { ...NO_STORE, name: 'bypass-invalid' }
    if (endpoint === 'getMatch') {
        const phase = phaseOfMatch(data?.match)
        if (phase === 'live') return { ...NO_STORE, name: 'live' }
        if (phase === 'played') return playedPolicy(ageSinceMatch(data?.match, now), 'store-played')
        return { cc: 'public, max-age=30', name: 'upcoming', store: true }
    }
    if (endpoint === 'getMatches') {
        const list = data?.matches || []
        if (list.some((m) => phaseOfMatch(m) === 'live')) return { ...NO_STORE, name: 'live-list' }
        if (list.length > 0 && list.every((m) => phaseOfMatch(m) === 'played')) {
            const newest = Math.min(...list.map((m) => ageSinceMatch(m, now)).map((a) => (Number.isFinite(a) ? a : 0)))
            return playedPolicy(newest, 'store-played-list')
        }
        return { cc: 'public, max-age=30', name: 'upcoming-list', store: true }
    }
    if (endpoint === 'getTeam' || endpoint === 'getPlayer' || endpoint === 'getGroup' || endpoint === 'getGroups') {
        if (/"status"\s*:\s*"(live|started|playing|inplay|in_play|ongoing|interrupted)"/i.test(raw)) {
            return { cc: 'public, max-age=30', name: 'roster-live', store: true }
        }
        return { cc: 'public, max-age=900, stale-while-revalidate=1800', name: 'roster', store: true }
    }
    return { cc: 'public, max-age=3600, stale-while-revalidate=86400', name: 'catalog', store: true }
}
