/**
 * Torneopal signs every call on spl.torneopal.net and salibandy-api.torneopal.net:
 * hash = sha256_hex(`<method>?<salt>&k1=v1&k2=v2…`) over raw values in query order,
 * appended last as `&hash=`. Same scheme as Pelipäivä's tasoRequestUrl.
 */
export const TASO_HASH_SALT = 'ysnyp4h6e9egetkc3s3v'
export const TASO_SIGNED_HOSTS: ReadonlySet<string> = new Set(['spl.torneopal.net', 'salibandy-api.torneopal.net'])

export async function tasoHash(method: string, params: Iterable<[string, string]>): Promise<string> {
    let input = `${method}?${TASO_HASH_SALT}`
    for (const [k, v] of params) input += `&${k}=${v}`
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
    return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
}

/** Returns the URL to fetch: signed (hash last) for signed hosts, unchanged otherwise. */
export async function signTasoUrl(target: URL): Promise<URL> {
    const out = new URL(target.toString())
    out.searchParams.delete('hash')
    if (!TASO_SIGNED_HOSTS.has(out.hostname)) return out
    const method = out.pathname.split('/').filter(Boolean).pop() || ''
    out.searchParams.append('hash', await tasoHash(method, [...out.searchParams]))
    return out
}
