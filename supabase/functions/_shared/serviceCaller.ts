// Is this request from our own backend (a service-role caller)?
//
// The normal case is an exact match with SUPABASE_SERVICE_ROLE_KEY, which is what our own functions send. Some environments hand out
// service-role keys in more than one form (a legacy JWT and a newer secret key) that are different strings for the same project, so
// when the exact match fails we ask Supabase itself: only a service-role key can list users through the admin API.

export async function isServiceCaller(req: Request, supabaseUrl: string, serviceRoleKey: string): Promise<boolean> {
  const bearer = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!bearer) return false
  if (bearer === serviceRoleKey) return true
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/admin/users?per_page=1`, { headers: { apikey: bearer, Authorization: `Bearer ${bearer}` } })
    return res.ok
  } catch {
    return false
  }
}
