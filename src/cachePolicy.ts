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

export function parsePayload(raw: string): {
    match?: { status?: unknown; time?: unknown }
    matches?: Array<{ status?: unknown; time?: unknown }>
} | null {
    const start = raw.indexOf('{')
    if (start < 0) return null
    try {
        return JSON.parse(raw.slice(start)) as {
            match?: { status?: unknown; time?: unknown }
            matches?: Array<{ status?: unknown; time?: unknown }>
        }
    } catch {
        return null
    }
}

/** Live: never. Upcoming: 30s (lineups). Played: immutable. Roster: 60s. */
export function cachePolicy(endpoint: string, raw: string): { cc: string; name: string; store: boolean } {
    const data = parsePayload(raw)
    if (endpoint === 'getMatch') {
        const phase = phaseOfMatch(data?.match)
        if (phase === 'live') return { cc: 'no-store', name: 'live', store: false }
        if (phase === 'played') return { cc: 'public, max-age=31536000, immutable', name: 'store-played', store: true }
        return { cc: 'public, max-age=30', name: 'upcoming', store: false }
    }
    if (endpoint === 'getMatches') {
        const list = data?.matches || []
        if (list.some((m) => phaseOfMatch(m) === 'live')) return { cc: 'no-store', name: 'live-list', store: false }
        return { cc: 'public, max-age=30', name: 'upcoming-list', store: false }
    }
    if (endpoint === 'getTeam' || endpoint === 'getPlayer' || endpoint === 'getGroup' || endpoint === 'getGroups') {
        return { cc: 'public, max-age=60', name: 'roster', store: false }
    }
    return { cc: 'public, max-age=300, stale-while-revalidate=600', name: 'catalog', store: false }
}
