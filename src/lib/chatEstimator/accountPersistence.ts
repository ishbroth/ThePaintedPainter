import { supabase } from '../supabase';
import { chatStateToPortable, chatStateFromPortable, type ChatState } from './chatEngine';

const TABLE = 'chat_estimator_sessions';

/** Best-effort — returns null on any failure (unreachable, RLS, corrupt row) so the caller just falls back to sessionStorage/fresh. */
export async function loadAccountChatState(userId: string): Promise<ChatState | null> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('state')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return chatStateFromPortable(data.state);
  } catch {
    return null;
  }
}

/** Best-effort — removes the signed-in customer's saved estimate so the next visit starts fresh. */
export async function deleteAccountChatState(userId: string): Promise<void> {
  try {
    await supabase.from(TABLE).delete().eq('user_id', userId);
  } catch {
    // ignore — non-critical
  }
}

/** Best-effort — a failed save just means this device falls back to sessionStorage for the rest of the tab's life; never throws. */
export async function saveAccountChatState(userId: string, state: ChatState): Promise<void> {
  try {
    await supabase
      .from(TABLE)
      .upsert({ user_id: userId, state: chatStateToPortable(state), updated_at: new Date().toISOString() });
  } catch {
    // ignore — non-critical
  }
}
