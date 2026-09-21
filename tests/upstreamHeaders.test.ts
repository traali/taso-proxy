import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { upstreamHeaders } from '../src/upstream.ts'

describe('upstreamHeaders', () => {
    it('does not send Origin (Torneopal 403s worker Origin: tulospalvelu.*)', () => {
        const h = upstreamHeaders('https://tulospalvelu.basket.fi/', 'json/df8e84j9xtdz269euy3h')
        assert.equal('Origin' in h, false)
        assert.equal(h.Referer, 'https://tulospalvelu.basket.fi/')
        assert.match(h.Accept, /^json\//)
    })
})
