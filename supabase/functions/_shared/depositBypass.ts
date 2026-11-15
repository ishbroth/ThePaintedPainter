// The one account that skips Stripe. Signed in as this customer, "pay the deposit" marks the deposit paid straight away (the job
// then goes through exactly the same steps as a paid one: confirmed, scheduled, completed, reviewed), without a card.
// Everything else about the account behaves like any other customer. Matching is on the job's signed-in customer's verified
// account email (never on text typed into a form).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const NO_PAYMENT_EMAILS = ['isaac.wiley99@gmail.com']

export async function skipsPayment(supabase: ReturnType<typeof createClient>, customerId: string | null): Promise<boolean> {
  if (!customerId) return false
  const { data } = await supabase.auth.admin.getUserById(customerId)
  const email = data?.user?.email?.trim().toLowerCase()
  return !!email && NO_PAYMENT_EMAILS.includes(email)
}
