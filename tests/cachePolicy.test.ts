import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { cachePolicy, phaseOfMatch } from '../src/cachePolicy.ts'

describe('phaseOfMatch', () => {
    it('treats live / clock as live', () => {
        assert.equal(phaseOfMatch({ status: 'Live' }), 'live')
        assert.equal(phaseOfMatch({ status: 'Played', time: "12'" }), 'live')
        assert.equal(phaseOfMatch({ status: 'in_play' }), 'live')
    })
    it('treats played as played', () => {
        assert.equal(phaseOfMatch({ status: 'Played' }), 'played')
        assert.equal(phaseOfMatch({ status: '1' }), 'played')
    })
    it('treats missing/fixture as upcoming', () => {
        assert.equal(phaseOfMatch({ status: 'Fixture' }), 'upcoming')
        assert.equal(phaseOfMatch({}), 'upcoming')
        assert.equal(phaseOfMatch(undefined), 'upcoming')
    })
})

describe('cachePolicy', () => {
    it('never stores live getMatch', () => {
        const p = cachePolicy('getMatch', JSON.stringify({ call: { status: 'ok' }, match: { status: 'Live' } }))
        assert.equal(p.store, false)
        assert.equal(p.cc, 'no-store')
        assert.equal(p.name, 'live')
    })
    it('played getMatch: 1 day in the first 24h, then 7 days, never immutable', () => {
        const body = JSON.stringify({ call: { status: 'ok' }, match: { status: 'Played', date: '2026-10-24' } })
        const fresh = cachePolicy('getMatch', body, Date.parse('2026-10-25T08:00:00+02:00'))
        assert.equal(fresh.store, true)
        assert.match(fresh.cc, /max-age=86400\b/)
        assert.doesNotMatch(fresh.cc, /immutable/)
        const old = cachePolicy('getMatch', body, Date.parse('2026-10-28T08:00:00+02:00'))
        assert.match(old.cc, /max-age=604800\b/)
    })
    it('never caches error, empty or non-JSON bodies', () => {
        for (const raw of ['', 'Not allowed', '{"call":{"status":"error","http":403},"error":"upstream"}', '{"call":{"status":"ok"}}', '[1]']) {
            const p = cachePolicy('getMatch', raw)
            assert.equal(p.store, false, raw)
            assert.equal(p.cc, 'no-store', raw)
        }
    })
    it('getMatches all played gets the long played cache', () => {
        const body = JSON.stringify({ call: { status: 'ok' }, matches: [{ status: 'Played', date: '2026-10-01' }, { status: 'Played', date: '2026-10-02' }] })
        const p = cachePolicy('getMatches', body, Date.parse('2026-10-25T08:00:00+02:00'))
        assert.equal(p.name, 'store-played-list')
        assert.match(p.cc, /max-age=604800\b/)
    })
    it('getTeam without live: 15 min + stale-while-revalidate', () => {
        const p = cachePolicy('getTeam', JSON.stringify({ call: { status: 'ok' }, team: { team_id: '1' } }))
        assert.equal(p.cc, 'public, max-age=900, stale-while-revalidate=1800')
        assert.equal(p.store, true)
    })
    it('keeps upcoming getMatch at 30s', () => {
        const p = cachePolicy('getMatch', JSON.stringify({ call: { status: 'ok' }, match: { status: 'Fixture' } }))
        assert.equal(p.store, true)
        assert.equal(p.cc, 'public, max-age=30')
        assert.equal(p.name, 'upcoming')
    })
    it('busts getMatches if any row is live', () => {
        const p = cachePolicy('getMatches', JSON.stringify({
            call: { status: 'ok' },
            matches: [{ status: 'Played' }, { status: 'Live' }],
        }))
        assert.equal(p.cc, 'no-store')
        assert.equal(p.name, 'live-list')
    })
    it('roster with a live match stays short', () => {
        const p = cachePolicy('getPlayer', JSON.stringify({ call: { status: 'ok' }, player: { matches: [{ status: 'Live' }] } }))
        assert.equal(p.cc, 'public, max-age=30')
    })
})
