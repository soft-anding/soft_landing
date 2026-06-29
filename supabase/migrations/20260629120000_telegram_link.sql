-- ============================================================
-- Migration: telegram_link
-- Adds the columns needed to link a user_profiles row to a Telegram
-- chat, so the notifications job can also push messages via the bot.
-- telegram_link_code is the short one-time code shown as a deep-link
-- query param (https://t.me/<bot>?start=<code>); cleared once the
-- bot's /start <code> message resolves it into a telegram_chat_id.
-- ============================================================

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS telegram_chat_id text,
  ADD COLUMN IF NOT EXISTS telegram_link_code text UNIQUE;
