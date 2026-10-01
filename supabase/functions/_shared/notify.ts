// In-app notification + web push, in one call.
//
// Inserts a row into `notifications` (what the Notifications pages read, live
// via realtime) and pushes it to every device the user has subscribed
// (push_subscriptions). Best-effort: a failure here must never break the
// business action that triggered it, so everything is caught and logged.
//
// Needs secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: or https: URL).

import webpush from 'npm:web-push@3.6.7'

// deno-lint-ignore no-explicit-any
type Supabase = any

export interface NotifyInput {
  userId: string | null | undefined
  type: string
  title: string
  body?: string
  /** App path to open when tapped, e.g. /customer/projects */
  link?: string
}

let vapidConfigured = false
function configureVapid(): boolean {
  if (vapidConfigured) return true
  const pub = Deno.env.get('VAPID_PUBLIC_KEY')
  const priv = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:iw@thepaintedpainter.com'
  if (!pub || !priv) return false
  webpush.setVapidDetails(subject, pub, priv)
  vapidConfigured = true
  return true
}

export async function notify(supabase: Supabase, input: NotifyInput): Promise<void> {
  if (!input.userId) return
  try {
    await supabase.from('notifications').insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
    })
  } catch (err) {
    console.error('notify: insert failed', err)
  }

  try {
    if (!configureVapid()) return
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', input.userId)
    if (!subs || subs.length === 0) return

    const payload = JSON.stringify({ title: input.title, body: input.body ?? '', link: input.link ?? '/', type: input.type })
    await Promise.allSettled(
      // deno-lint-ignore no-explicit-any
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload)
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          // Subscription is gone (uninstalled / permission revoked) — clean it up.
          if (status === 404 || status === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', s.id)
          } else {
            console.error('notify: push failed', status, err)
          }
        }
      }),
    )
  } catch (err) {
    console.error('notify: push error', err)
  }
}
