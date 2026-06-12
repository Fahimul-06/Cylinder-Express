# Supabase Edge Function Secrets

Set the SMS credentials as Supabase secrets instead of hardcoding them in `supabase/functions/send-otp/index.ts`.

```bash
supabase secrets set BULKSMSBD_API_KEY="your-real-api-key"
supabase secrets set BULKSMSBD_SENDER_ID="your-approved-sender-id"
```

For local edge-function testing, copy `supabase/functions/.env.example` to `supabase/functions/.env` and fill in real values locally only.
