/**
 * Global upstream budget: one Durable Object instance per sport (idFromName(sport)) is a single
 * global counter, unlike per-isolate memory or the per-colo rate-limit binding.
 * Fixed one-minute window. Only cache misses ask for budget.
 */
export class UpstreamBudget {
    private windowStart = 0
    private used = 0
    constructor(_state: unknown) {}

    async fetch(req: Request): Promise<Response> {
        const cap = Number(new URL(req.url).searchParams.get('cap')) || 60
        const now = Date.now()
        if (now - this.windowStart >= 60_000) {
            this.windowStart = now - (now % 60_000)
            this.used = 0
        }
        const ok = this.used < cap
        if (ok) this.used++
        return new Response(JSON.stringify({ ok, used: this.used, cap, resetMs: this.windowStart + 60_000 - now }), {
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

export type BudgetNs = { idFromName(n: string): unknown; get(id: unknown): { fetch(u: string): Promise<Response> } }

/** true = may call upstream. Fails closed (no call) only if the DO answers "over"; DO errors fail open. */
export async function takeBudget(ns: BudgetNs | undefined, sport: string, cap: number): Promise<boolean> {
    if (!ns) return true
    try {
        const stub = ns.get(ns.idFromName(sport))
        const r = (await (await stub.fetch(`https://budget/take?cap=${cap}`)).json()) as { ok: boolean }
        return r.ok
    } catch {
        return true
    }
}
