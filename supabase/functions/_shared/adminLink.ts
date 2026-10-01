// Signed, expiring links for the admin review page (/admin/painter-review).
//
// The admin acts on a painter application straight from the email sent at
// sign-up, with no login. The link carries an HMAC of the painter id + expiry,
// keyed by ADMIN_ACTION_SECRET, so it can't be forged or reused for another
// painter. The link only opens a page; nothing changes until the admin clicks
// a button there (so email link scanners that prefetch URLs can't approve anyone).

const enc = new TextEncoder()

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function secret(): string {
  const s = Deno.env.get('ADMIN_ACTION_SECRET')
  if (!s) throw new Error('ADMIN_ACTION_SECRET is not set')
  return s
}

export async function signReviewLink(painterId: string, days = 60): Promise<{ exp: number; sig: string }> {
  const exp = Math.floor(Date.now() / 1000) + days * 86400
  return { exp, sig: await hmacHex(secret(), `${painterId}.${exp}`) }
}

export async function verifyReviewLink(painterId: string, exp: number, sig: string): Promise<boolean> {
  if (!painterId || !exp || !sig || exp < Math.floor(Date.now() / 1000)) return false
  const expected = await hmacHex(secret(), `${painterId}.${exp}`)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export async function buildReviewUrl(painterId: string): Promise<string> {
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://thepaintedpainter.com'
  const { exp, sig } = await signReviewLink(painterId)
  return `${frontendUrl}/admin/painter-review?id=${painterId}&exp=${exp}&sig=${sig}`
}

export const ADMIN_EMAIL = () => Deno.env.get('APPLICATION_NOTIFICATION_EMAIL') ?? 'iw@thepaintedpainter.com'
