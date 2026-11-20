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
  /** messaging was turned off for this job by either side (never says which) */
  blocked: boolean;
  /** this person is the one who turned it off, so they can turn it back on */
  blockedByMe: boolean;
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
export const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'inappropriate', label: 'Inappropriate or offensive' },
  { value: 'spam', label: 'Spam or unrelated' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'off_platform', label: 'Pushing to pay or work outside the app' },
  { value: 'other', label: 'Something else' },
] as const;
export type ReportReason = typeof REPORT_REASONS[number]['value'];
export const MAX_REPORT_DETAILS = 500;

/** Report the other person on this job, optionally pointing at one of their messages, optionally turning messaging off at the same time. */
export const reportThread = (token: string, jobId: string, report: { reason: ReportReason; details?: string; messageId?: string; alsoBlock?: boolean }) =>
  call<{ success: true; blocked: boolean }>(token, { action: 'report', jobId, ...report });
/** Turn messaging off (or back on) for this job. The job itself carries on. */
export const setMessagingBlocked = (token: string, jobId: string, blocked: boolean) =>
  call<{ success: true; blockedByMe: boolean }>(token, { action: blocked ? 'block' : 'unblock', jobId });
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
