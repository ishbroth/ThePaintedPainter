-- =============================================
-- Chat estimator rate limiting
-- =============================================
-- Backs the chat-estimator-extract Edge Function's anti-abuse check so a
-- single client can't burn through Anthropic API credits by spamming
-- requests. Keyed by client IP (the function has no auth requirement, since
-- anonymous visitors use the estimator). check_chat_rate_limit() is a single
-- atomic UPSERT so concurrent requests from the same client can't race past
-- the limit.

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  client_key TEXT PRIMARY KEY,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  request_count INTEGER NOT NULL DEFAULT 1
);

-- Only the service role (used by the Edge Function) touches this table.
ALTER TABLE chat_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_chat_rate_limit(
  p_client_key TEXT,
  p_window_seconds INTEGER,
  p_max_requests INTEGER
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN;
BEGIN
  INSERT INTO chat_rate_limits (client_key, window_start, request_count)
  VALUES (p_client_key, NOW(), 1)
  ON CONFLICT (client_key) DO UPDATE
    SET request_count = CASE
          WHEN chat_rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL
            THEN 1
          ELSE chat_rate_limits.request_count + 1
        END,
        window_start = CASE
          WHEN chat_rate_limits.window_start < NOW() - (p_window_seconds || ' seconds')::INTERVAL
            THEN NOW()
          ELSE chat_rate_limits.window_start
        END
  RETURNING (request_count <= p_max_requests) INTO v_allowed;

  RETURN v_allowed;
END;
$$;
