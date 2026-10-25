import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { UpstreamBudget, takeBudget } from '../src/budget.ts'

describe('UpstreamBudget (global per-sport cap)', () => {
    it('allows cap calls per minute then refuses', async () => {
        const b = new UpstreamBudget({} as never)
        const take = async () => ((await (await b.fetch(new Request('https://budget/take?cap=3'))).json()) as { ok: boolean }).ok
        assert.deepEqual([await take(), await take(), await take(), await take()], [true, true, true, false])
    })
    it('one instance per sport via idFromName', async () => {
        const inst = new Map<string, UpstreamBudget>()
        const ns = {
            idFromName: (n: string) => n,
            get: (id: unknown) => {
                const k = String(id)
                if (!inst.has(k)) inst.set(k, new UpstreamBudget({} as never))
                return { fetch: (u: string) => inst.get(k)!.fetch(new Request(u)) }
            },
        }
        assert.equal(await takeBudget(ns, 'volley', 1), true)
        assert.equal(await takeBudget(ns, 'volley', 1), false)
        assert.equal(await takeBudget(ns, 'basket', 1), true)
    })
})
