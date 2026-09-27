import express from 'express';

export function createRouter(ctx) {
  const router = express.Router();
  const { requireAuth, models, getAuthenticatedProfile } = ctx;
  router.get('/api/delivery-chat/conversations', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      if (!profile?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
      const deliveryProfiles = await models.profiles.find({ role: 'delivery', is_active: { $ne: false } }).lean();
      const rows = await Promise.all(deliveryProfiles.map(async (delivery) => {
        const deliveryId = String(delivery.user_id);
        const [latest, unread] = await Promise.all([
          models.delivery_admin_messages.findOne({ delivery_user_id: deliveryId }).sort({ created_at: -1 }).lean(),
          models.delivery_admin_messages.countDocuments({ delivery_user_id: deliveryId, sender_role: 'delivery', read_by_admin: false }),
        ]);
        return {
          delivery_user_id: deliveryId,
          full_name: delivery.full_name || 'HUB Man',
          phone: delivery.phone || '',
          avatar_url: delivery.avatar_url || null,
          last_message: latest?.message || '',
          last_message_at: latest?.created_at || delivery.created_at,
          unread_count: unread,
        };
      }));
      rows.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      res.set('Cache-Control', 'no-store');
      res.json({ data: rows, error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.get('/api/delivery-chat/messages', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      let deliveryUserId;
      if (profile?.role === 'delivery') deliveryUserId = req.auth.id;
      else if (profile?.is_admin) deliveryUserId = String(req.query.delivery_user_id || '');
      else return res.status(403).json({ error: 'Delivery or admin access required.' });
      if (!deliveryUserId) return res.status(400).json({ error: 'HUB Man is required.' });
      const messages = await models.delivery_admin_messages.find({ delivery_user_id: deliveryUserId }).sort({ created_at: 1 }).limit(300).lean();
      res.set('Cache-Control', 'no-store');
      res.json({ data: messages.map(m => ({ ...m, id: String(m._id) })), error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/api/delivery-chat/messages', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      const text = String(req.body.message || '').trim();
      if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
      if (text.length > 2000) return res.status(400).json({ error: 'Message is too long.' });
      let deliveryUserId;
      let senderRole;
      if (profile?.role === 'delivery') { deliveryUserId = req.auth.id; senderRole = 'delivery'; }
      else if (profile?.is_admin) { deliveryUserId = String(req.body.delivery_user_id || ''); senderRole = 'admin'; }
      else return res.status(403).json({ error: 'Delivery or admin access required.' });
      if (!deliveryUserId) return res.status(400).json({ error: 'HUB Man is required.' });
      const delivery = await models.profiles.findOne({ user_id: deliveryUserId, role: 'delivery' });
      if (!delivery) return res.status(404).json({ error: 'HUB Man not found.' });
      const senderName = senderRole === 'admin'
        ? (profile?.full_name || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
        : (profile?.full_name || 'HUB Man');
      const senderPosition = senderRole === 'admin'
        ? (profile?.employee_position || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
        : null;
      const doc = await models.delivery_admin_messages.create({
        delivery_user_id: deliveryUserId,
        sender_id: req.auth.id,
        sender_role: senderRole,
        sender_name: senderName,
        sender_position: senderPosition,
        message: text,
        read_by_admin: senderRole === 'admin',
        read_by_delivery: senderRole === 'delivery',
      });
      res.status(201).json({ data: doc.toJSON(), error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/api/delivery-chat/read', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      let deliveryUserId;
      let update;
      if (profile?.role === 'delivery') {
        deliveryUserId = req.auth.id;
        update = { read_by_delivery: true, updated_at: new Date() };
      } else if (profile?.is_admin) {
        deliveryUserId = String(req.body.delivery_user_id || '');
        update = { read_by_admin: true, updated_at: new Date() };
      } else return res.status(403).json({ error: 'Delivery or admin access required.' });
      if (!deliveryUserId) return res.status(400).json({ error: 'HUB Man is required.' });
      await models.delivery_admin_messages.updateMany({ delivery_user_id: deliveryUserId }, { $set: update });
      res.json({ success: true, error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
