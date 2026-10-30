// Signed prices.
//
// The estimate is computed in the browser, so the server can't recompute it, but
// it CAN make sure the price a customer claims is one our own results function
// produced, for that painter and ZIP, and that it hasn't expired. painter-results
// signs each painter's price (and the Mystery Painter baseline) with a secret
// the browser never sees; submit-quote-claim refuses anything unsigned, altered
// or past its hold time. (A tampered *estimate* can still be fed into the results
// function itself, bounded by the $100-$250,000 range, but a price can no
// longer be edited after the fact, swapped between painters, or used after the
// hold expires.)

const enc = new TextEncoder()

async function hmacHex(message: string): Promise<string> {
  const secret = Deno.env.get('PRICE_TOKEN_SECRET')
  if (!secret) throw new Error('PRICE_TOKEN_SECRET is not set')
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** subject is a painter id, or 'mystery' for the baseline price. */
export async function signPrice(subject: string, price: number, zip: string, expiresAtMs: number): Promise<string> {
  const sig = await hmacHex(`${subject}|${Math.round(price)}|${zip}|${expiresAtMs}`)
  return `${expiresAtMs}.${sig}`
}

export async function verifyPrice(subject: string, price: number, zip: string, token: unknown): Promise<'ok' | 'expired' | 'invalid'> {
  if (typeof token !== 'string') return 'invalid'
  const [expStr, sig] = token.split('.')
  const exp = Number(expStr)
  if (!exp || !sig) return 'invalid'
  const expected = await hmacHex(`${subject}|${Math.round(price)}|${zip}|${exp}`)
  if (expected.length !== sig.length) return 'invalid'
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  if (diff !== 0) return 'invalid'
  return Date.now() > exp ? 'expired' : 'ok'
}

// ---- cancel links ----
// The "Cancel request" button in the customer's confirmation email carries a token signed from the job's id, so it needs no stored token
// (and a painter, who holds only the accept token, can never cancel a job).

/** A token for cancelling one job: "<job id>.<signature>". */
export async function signCancel(jobId: string): Promise<string> {
  return `${jobId}.${await hmacHex(`cancel|${jobId}`)}`
}

/** The job id inside a cancel token, or null when the token is not genuine. */
export async function verifyCancel(token: unknown): Promise<string | null> {
  if (typeof token !== 'string') return null
  const at = token.indexOf('.')
  if (at < 1) return null
  const jobId = token.slice(0, at)
  const sig = token.slice(at + 1)
  const expected = await hmacHex(`cancel|${jobId}`)
  if (expected.length !== sig.length) return null
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0 ? jobId : null
}
