export function registerTableRoutes(ctx) {
  const { app, models, mongoose, bcrypt, jwt, crypto, multer, path, rootDir, JWT_SECRET, SMS_ENABLED, BULKSMSBD_API_URL, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, CHATBOT_API_KEY, CHATBOT_API_URL, CHATBOT_MODEL, CHATBOT_ENABLED, GOOGLE_GEOCODING_API_KEY, geocodeDeliveryBase, signUser, fetchSocialProfile, signInOrCreateSocialUser, sanitizePermissions, hasAdminPermission, ADMIN_PERMISSIONS, getOrderAdmins, createNotification, silenceOrderNotifications, notifyAdmins, notifyOrderCustomer, notifyDeliveryManAssignment, parseCylinderSizeKg, defaultUsageDaysForKg, median, rebuildLpgUsageProfiles, runLpgEmptyReminderChecks, runOrderAlertChecks, sendBulkSmsBdMessage, requireAuth, requireAdminPermission, requireAdminUserManagement, normalizeMongoField, buildMongoQuery, getOptionalAuthUserId, ensureUserOwnedPayload, decorate, upload } = ctx;
app.post('/api/tables/:table', async (req, res) => {
  try {
    const Model = models[req.params.table];
    if (!Model) return res.status(404).json({ error: 'Unknown table' });
    const { action, filters = [], order, limit, body, single, select, count } = req.body;
    const query = buildMongoQuery(filters);
    let data = null;
    let totalCount = null;

    if (action === 'select') {
      let q = Model.find(query);
      if (order?.field) q = q.sort({ [order.field]: order.ascending ? 1 : -1 });
      if (limit) q = q.limit(limit);
      const docs = await q;
      data = docs.map((d) => d.toJSON());
      totalCount = count ? await Model.countDocuments(query) : null;
      data = await decorate(req.params.table, data, select || '');
    }

    if (action === 'insert') {
      const userId = getOptionalAuthUserId(req);
      const payload = Array.isArray(body) ? body : [body];

      if (req.params.table === 'orders') {
        for (const rawItem of payload) {
          const item = ensureUserOwnedPayload(req.params.table, rawItem, userId);
          const customerId = item.user_id || userId;
          const customerProfile = customerId ? await models.profiles.findOne({ user_id: customerId }) : null;
          if (!customerProfile || !isRealCustomerPhone(customerProfile.phone)) {
            return res.status(400).json({ data: null, error: 'Please add and verify your phone number before placing an order.' });
          }
          if (item.promo_code) {
            const code = String(item.promo_code).trim().toUpperCase();
            const offer = await models.offers.findOne({ code, is_active: true });
            if (!offer) {
              return res.status(400).json({ data: null, error: 'Invalid or expired promo code.' });
            }
            if (offer.valid_until && new Date(offer.valid_until) < new Date()) {
              return res.status(400).json({ data: null, error: 'This promo code has expired.' });
            }

            const maxUses = Math.max(1, Number(offer.max_uses_per_customer || 1));
            if (customerId) {
              const usedCount = await models.orders.countDocuments({
                user_id: customerId,
                promo_code: code,
                status: { $ne: 'cancelled' },
              });
              if (usedCount >= maxUses) {
                return res.status(400).json({
                  data: null,
                  error: maxUses === 1
                    ? 'You have already used this promo code.'
                    : `You have already used this promo code ${maxUses} times.`,
                });
              }
            }
            rawItem.promo_code = code;
          }
        }
      }

      const docs = await Model.insertMany(payload.map((item) => ({
        ...ensureUserOwnedPayload(req.params.table, item, userId),
        updated_at: new Date(),
      })));
      data = docs.map((d) => d.toJSON());

      if (req.params.table === 'orders') {
        await Promise.all(docs.map(async (order) => {
          const orderNumber = String(order.id).slice(-6).toUpperCase();
          const totalPayable = Number(order.total_amount || 0)
            + Number(order.delivery_fee || 0)
            + Number(order.floor_charge || 0)
            - Number(order.discount_amount || 0);
          const address = order.address_id
            ? await models.addresses.findById(order.address_id).catch(() => null)
            : null;
          const addressText = address
            ? [address.address_line1, address.area, address.city, address.district].filter(Boolean).join(', ')
            : 'Customer address selected';

          await notifyAdmins({
            order_id: order.id,
            type: 'new_order_admin',
            title: 'New order received',
            message: `New order #${orderNumber} placed. Amount: ৳${totalPayable.toLocaleString('en-BD')}. Address: ${addressText}. Confirm or assign delivery now.`,
            urgent: true,
            buzz: true,
          });
        }));
      }
    }

    if (action === 'upsert') {
      const userId = getOptionalAuthUserId(req);
      const payload = Array.isArray(body) ? body : [body];
      const output = [];
      for (const rawItem of payload) {
        const item = ensureUserOwnedPayload(req.params.table, rawItem, userId);
        const { id, ...itemWithoutId } = item;
        const upsertQuery = id ? { _id: id } : item.user_id ? { user_id: item.user_id } : buildMongoQuery(filters);
        const doc = await Model.findOneAndUpdate(upsertQuery, { ...itemWithoutId, updated_at: new Date() }, { new: true, upsert: true, setDefaultsOnInsert: true });
        output.push(doc.toJSON());
      }
      data = output;
    }

    if (action === 'update') {
      const previousDocs = req.params.table === 'orders' ? await Model.find(query) : [];
      const updatePayload = { ...body, updated_at: new Date() };
      if (req.params.table === 'orders' && body?.status) {
        if (body.status === 'confirmed') updatePayload.confirmed_at = new Date();
        if (body.status === 'processing') {
          updatePayload.delivery_accepted_at = body.delivery_accepted_at ? new Date(body.delivery_accepted_at) : new Date();
          updatePayload.delivery_accept_reminder_last_sent_at = null;
        }
        if (body.status === 'delivered') updatePayload.delivered_at = new Date();
        if (body.status === 'cancelled') updatePayload.cancelled_at = new Date();
      }
      if (req.params.table === 'orders' && body?.delivery_man_id !== undefined) {
        if (body.delivery_man_id) {
          updatePayload.delivery_assigned_at = new Date();
          updatePayload.delivery_accepted_at = null;
          updatePayload.delivery_accept_reminder_last_sent_at = null;
          updatePayload.delivery_delivered_reminder_last_sent_at = null;
          updatePayload.delivery_delay_notified_at = null;
        } else {
          updatePayload.delivery_assigned_at = null;
          updatePayload.delivery_accepted_at = null;
          updatePayload.delivery_accept_reminder_last_sent_at = null;
          updatePayload.delivery_delivered_reminder_last_sent_at = null;
        }
      }
      if (req.params.table === 'profiles' && body?.phone !== undefined) {
        const normalizedPhone = normalizeCustomerPhone(body.phone);
        if (!isRealCustomerPhone(normalizedPhone)) {
          return res.status(400).json({ data: null, error: 'Invalid Bangladesh phone number.' });
        }
        updatePayload.phone = normalizedPhone;
      }

      await Model.updateMany(query, updatePayload);
      const updatedDocs = await Model.find(query);
      data = updatedDocs.map((d) => d.toJSON());

      if (req.params.table === 'profiles' && body?.phone !== undefined) {
        for (const profile of updatedDocs) {
          await models.users.findByIdAndUpdate(profile.user_id, { phone: updatePayload.phone });
        }
        data = updatedDocs.map((d) => d.toJSON());
      }

      if (req.params.table === 'orders') {
        const previousById = new Map(previousDocs.map((doc) => [doc.id, doc]));
        for (const order of updatedDocs) {
          const previous = previousById.get(order.id);
          const previousDeliveryManId = String(previous?.delivery_man_id || '');
          const currentDeliveryManId = String(order.delivery_man_id || '');

          if (body?.status && previous?.status !== order.status && ['confirmed', 'delivered'].includes(String(order.status))) {
            await notifyOrderCustomer(order, order.status);
          }

          if (body?.status === 'processing') {
            await silenceOrderNotifications(order.id, ['delivery_assigned', 'delivery_accept_overdue'], currentDeliveryManId);
          }

          if (['delivered', 'cancelled'].includes(String(body?.status || ''))) {
            await silenceOrderNotifications(order.id, [
              'delivery_assigned',
              'delivery_accept_overdue',
              'delivery_not_delivered_20m_admin',
            ]);
          }

          if (body?.delivery_man_id !== undefined && previousDeliveryManId !== currentDeliveryManId) {
            if (previousDeliveryManId) {
              await silenceOrderNotifications(order.id, ['delivery_assigned', 'delivery_accept_overdue'], previousDeliveryManId);
            }
            await silenceOrderNotifications(order.id, ['delivery_not_delivered_20m_admin']);
            if (order.delivery_man_id) {
              await notifyDeliveryManAssignment(order);
            }
          }
        }
      }

      if (req.params.table === 'orders' && ['delivered', 'cancelled'].includes(String(body?.status || ''))) {
        const orderIds = updatedDocs.map((doc) => doc.id);
        const userIds = updatedDocs.map((doc) => doc.user_id).filter(Boolean);
        await models.customer_locations.updateMany(
          { $or: [{ active_order_id: { $in: orderIds } }, { user_id: { $in: userIds } }] },
          { $set: { active_order_id: null, is_sharing: false, updated_at: new Date() } }
        );

        // HUB Man's device location sharing stays ON after completing an order.
        // Customer visibility is controlled by order status on the customer app, so delivered/cancelled
        // orders no longer display the HUB man's live location while the driver can continue
        // sharing for the next assigned delivery without turning location on again.
      }
    }

    if (action === 'delete') {
      const docs = await Model.find(query);
      await Model.deleteMany(query);
      data = docs.map((d) => d.toJSON());
    }

    if (single === 'single' || single === 'maybeSingle') data = Array.isArray(data) ? (data[0] || null) : data;
    res.json({ data, error: null, count: totalCount });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message });
  }
});

}
