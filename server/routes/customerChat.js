import express from 'express';

export function createRouter(ctx) {
  const router = express.Router();
  const { requireAuth, models, getAuthenticatedProfile } = ctx;
  router.get('/api/customer-chat/conversations', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      if (!profile?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
      const customerIds = await models.customer_admin_messages.distinct('customer_user_id');
      const rows = await Promise.all(customerIds.map(async (customerId) => {
        const [customer, latest, unread] = await Promise.all([
          models.profiles.findOne({ user_id: customerId }).lean(),
          models.customer_admin_messages.findOne({ customer_user_id: customerId }).sort({ created_at: -1 }).lean(),
          models.customer_admin_messages.countDocuments({ customer_user_id: customerId, sender_role: 'customer', read_by_admin: false }),
        ]);
        return {
          customer_user_id: String(customerId),
          full_name: customer?.full_name || 'Customer',
          phone: customer?.phone || '',
          avatar_url: customer?.avatar_url || null,
          last_message: latest?.message || '',
          last_message_at: latest?.created_at || customer?.created_at,
          unread_count: unread,
        };
      }));
      rows.sort((a, b) => new Date(b.last_message_at || 0) - new Date(a.last_message_at || 0));
      res.set('Cache-Control', 'no-store');
      res.json({ data: rows, error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.get('/api/customer-chat/messages', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      let customerUserId;
      if (profile?.is_admin) customerUserId = String(req.query.customer_user_id || '');
      else if (profile?.role !== 'delivery') customerUserId = req.auth.id;
      else return res.status(403).json({ error: 'Customer or admin access required.' });
      if (!customerUserId) return res.status(400).json({ error: 'Customer is required.' });
      const messages = await models.customer_admin_messages.find({ customer_user_id: customerUserId }).sort({ created_at: 1 }).limit(300).lean();
      res.set('Cache-Control', 'no-store');
      res.json({ data: messages.map(m => ({ ...m, id: String(m._id) })), error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/api/customer-chat/messages', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      const text = String(req.body.message || '').trim();
      if (!text) return res.status(400).json({ error: 'Message cannot be empty.' });
      if (text.length > 2000) return res.status(400).json({ error: 'Message is too long.' });
      let customerUserId; let senderRole;
      if (profile?.is_admin) { customerUserId = String(req.body.customer_user_id || ''); senderRole = 'admin'; }
      else if (profile?.role !== 'delivery') { customerUserId = req.auth.id; senderRole = 'customer'; }
      else return res.status(403).json({ error: 'Customer or admin access required.' });
      if (!customerUserId) return res.status(400).json({ error: 'Customer is required.' });
      const customer = await models.profiles.findOne({ user_id: customerUserId, role: { $ne: 'delivery' }, is_admin: { $ne: true } });
      if (!customer) return res.status(404).json({ error: 'Customer not found.' });
      const senderName = senderRole === 'admin'
        ? (profile?.full_name || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
        : (profile?.full_name || 'Customer');
      const senderPosition = senderRole === 'admin'
        ? (profile?.employee_position || (profile?.role === 'sub_admin' ? 'Employee' : 'Administration Head'))
        : null;
      const doc = await models.customer_admin_messages.create({
        customer_user_id: customerUserId, sender_id: req.auth.id, sender_role: senderRole,
        sender_name: senderName, sender_position: senderPosition, message: text,
        read_by_admin: senderRole === 'admin', read_by_customer: senderRole === 'customer',
      });
      res.status(201).json({ data: { ...doc.toJSON(), id: String(doc._id) }, error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/api/customer-chat/read', requireAuth, async (req, res) => {
    try {
      const profile = await getAuthenticatedProfile(req);
      let customerUserId; let update;
      if (profile?.is_admin) { customerUserId = String(req.body.customer_user_id || ''); update = { read_by_admin: true, updated_at: new Date() }; }
      else if (profile?.role !== 'delivery') { customerUserId = req.auth.id; update = { read_by_customer: true, updated_at: new Date() }; }
      else return res.status(403).json({ error: 'Customer or admin access required.' });
      if (!customerUserId) return res.status(400).json({ error: 'Customer is required.' });
      await models.customer_admin_messages.updateMany({ customer_user_id: customerUserId }, { $set: update });
      res.json({ success: true, error: null });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  return router;
}
