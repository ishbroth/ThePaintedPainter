// In-app messages between the customer and the painter of a confirmed job. Everything goes through the job-messages
// edge function, which checks the caller is on the job and that it is confirmed (see supabase/functions/job-messages).

import { useCallback, useEffect, useState } from 'react';
import { supabaseUrl } from './supabase';

export const MAX_MESSAGE_LENGTH = 1000;

export interface ThreadMessage {
  id: string;
  from: 'me' | 'them';
  body: string;
  createdAt: string;
  read: boolean;
}

export interface Thread {
  role: 'customer' | 'painter';
  canSend: boolean;
  otherName: string;
  messages: ThreadMessage[];
}

export class MessagingError extends Error {
  locked: boolean;
  constructor(message: string, locked = false) {
    super(message);
    this.locked = locked;
  }
}

async function call<T>(token: string, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${supabaseUrl}/functions/v1/job-messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new MessagingError(data.error || 'Something went wrong. Please try again.', !!data.locked);
  return data as T;
}

export const loadThread = (token: string, jobId: string) => call<Thread>(token, { action: 'list', jobId });
export const sendMessage = (token: string, jobId: string, body: string) => call<{ success: true; message: ThreadMessage }>(token, { action: 'send', jobId, body });
export const loadUnread = (token: string) => call<{ unread: Record<string, number> }>(token, { action: 'unread' }).then((r) => r.unread);

/** Unread message counts per job for the signed-in user, refreshed every minute and whenever `refresh` is called. */
export function useUnreadMessages(token: string | undefined) {
  const [unread, setUnread] = useState<Record<string, number>>({});
  const refresh = useCallback(() => {
    if (!token) return;
    loadUnread(token).then(setUnread).catch(() => { /* the badge is a convenience: stay quiet if it cannot load */ });
  }, [token]);
  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  return { unread, refresh };
}
