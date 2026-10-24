import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { signTasoUrl, tasoHash } from '../src/sign.ts'

const sha = (s: string) => createHash('sha256').update(s).digest('hex')

describe('TASO signing', () => {
    it('hashes <method>?salt&k=v with raw values in query order', async () => {
        assert.equal(
            await tasoHash('getMatches', [['team_id', '123'], ['date', '2026-10-24 12:00']]),
            sha('getMatches?ysnyp4h6e9egetkc3s3v&team_id=123&date=2026-10-24 12:00'),
        )
        assert.equal(await tasoHash('getSeasons', []), sha('getSeasons?ysnyp4h6e9egetkc3s3v'))
    })
    for (const host of ['spl.torneopal.net', 'salibandy-api.torneopal.net']) {
        it(`appends hash last for ${host}`, async () => {
            const u = await signTasoUrl(new URL(`https://${host}/taso/rest/getMatch?match_id=42&hash=bogus`))
            const keys = [...u.searchParams.keys()]
            assert.deepEqual(keys, ['match_id', 'hash'])
            assert.equal(u.searchParams.get('hash'), sha('getMatch?ysnyp4h6e9egetkc3s3v&match_id=42'))
        })
    }
    it('leaves unsigned hosts unsigned', async () => {
        const u = await signTasoUrl(new URL('https://koripallo-api.torneopal.net/taso/rest/getMatch?match_id=1'))
        assert.equal(u.searchParams.has('hash'), false)
    })
})
