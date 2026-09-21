export function upstreamHeaders(referer: string, accept: string): Record<string, string> {
    // Torneopal 403s when Origin matches tulospalvelu.* but the TCP peer is not
    // that site (Cloudflare Worker). Referer + Accept key is enough.
    return {
        Accept: accept,
        Referer: referer,
        'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
    }
}
