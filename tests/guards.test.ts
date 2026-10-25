import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { localRateLimited, originAllowed, validateParams } from '../src/guards.ts'

describe('originAllowed', () => {
    it('allows the house apps, their previews, localhost and non-browser callers', () => {
        for (const o of [
            'https://volleyball-stats-7xq.pages.dev',
            'https://pelipaiva.pages.dev',
            'https://abc123.basketball-stats-byu.pages.dev',
            'http://localhost:5173',
            'http://127.0.0.1:8080',
            null,
        ]) assert.equal(originAllowed(o), true, String(o))
    })
    it('rejects everyone else', () => {
        for (const o of ['https://evil.pages.dev', 'https://pelipaiva.pages.dev.evil.com', 'http://pelipaiva.pages.dev', 'https://example.com', 'null', 'https://a.b.pelipaiva.pages.dev'])
            assert.equal(originAllowed(o), false, o)
    })
})

describe('validateParams', () => {
    const v = (e: string, q: string) => validateParams(e, new URLSearchParams(q))
    it('accepts known well-formed params', () => {
        assert.equal(v('getMatch', 'match_id=816603'), null)
        assert.equal(v('getMatches', 'competition_id=vl2526&category_id=M1&date=2026-10-24&_cb=1'), null)
        assert.equal(v('getGroup', 'group_id=1&matches=1'), null)
    })
    it('rejects unknown keys and non-numeric ids', () => {
        assert.match(v('getMatch', 'match_id=1 OR 1') || '', /bad match_id/)
        assert.match(v('getMatch', 'match_id=abc') || '', /bad match_id/)
        assert.match(v('getTeam', 'evil=1') || '', /unknown/)
        assert.match(v('getMatches', 'date=tomorrow') || '', /bad date/)
    })
})

describe('localRateLimited', () => {
    it('limits per IP per window', () => {
        const t = 1_000_000
        for (let i = 0; i < 3; i++) assert.equal(localRateLimited('ip-a', 3, 60_000, t), false)
        assert.equal(localRateLimited('ip-a', 3, 60_000, t), true)
        assert.equal(localRateLimited('ip-b', 3, 60_000, t), false)
        assert.equal(localRateLimited('ip-a', 3, 60_000, t + 60_000), false)
    })
})
