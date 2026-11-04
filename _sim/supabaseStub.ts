// Offline stand-in for src/lib/supabase.ts: every function call fails, so the estimator uses its local rules engine.
export const supabaseUrl = 'offline';
export const supabaseAnonKey = 'offline';
export const supabase = {
  functions: { invoke: async () => ({ data: null, error: new Error('offline (rules-engine test mode)') }) },
  rpc: async () => ({ data: null, error: new Error('offline') }),
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }),
} as never;
