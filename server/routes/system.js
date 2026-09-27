import express from 'express';

export function createRouter(ctx) {
  const router = express.Router();
  const { requireAuth, requireAdminUserManagement, SMS_ENABLED, BULKSMSBD_SENDER_ID } = ctx;
  router.get('/api/admin/sms-status', requireAuth, requireAdminUserManagement, (_req, res) => {
    res.json({
      data: {
        enabled: SMS_ENABLED,
        api_url: BULKSMSBD_API_URL,
        has_api_key: Boolean(BULKSMSBD_API_KEY),
        has_sender_id: Boolean(BULKSMSBD_SENDER_ID),
        sender_id: BULKSMSBD_SENDER_ID || null,
      },
      error: null,
    });
  });



  return router;
}
