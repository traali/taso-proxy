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
        const p = cachePolicy('getMatch', JSON.stringify({ match: { status: 'Live' } }))
        assert.equal(p.store, false)
        assert.equal(p.cc, 'no-store')
        assert.equal(p.name, 'live')
    })
    it('stores played getMatch immutable', () => {
        const p = cachePolicy('getMatch', JSON.stringify({ match: { status: 'Played' } }))
        assert.equal(p.store, true)
        assert.match(p.cc, /immutable/)
    })
    it('keeps upcoming getMatch at 30s and does not store', () => {
        const p = cachePolicy('getMatch', JSON.stringify({ match: { status: 'Fixture' } }))
        assert.equal(p.store, false)
        assert.equal(p.cc, 'public, max-age=30')
        assert.equal(p.name, 'upcoming')
    })
    it('busts getMatches if any row is live', () => {
        const p = cachePolicy('getMatches', JSON.stringify({
            matches: [{ status: 'Played' }, { status: 'Live' }],
        }))
        assert.equal(p.cc, 'no-store')
        assert.equal(p.name, 'live-list')
    })
    it('keeps roster endpoints at 60s', () => {
        const p = cachePolicy('getPlayer', '{}')
        assert.equal(p.cc, 'public, max-age=60')
        assert.equal(p.store, false)
    })
})
