export function registerNotificationRoutes(ctx) {
  const { app, models, mongoose, bcrypt, jwt, crypto, multer, path, rootDir, JWT_SECRET, SMS_ENABLED, BULKSMSBD_API_URL, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, CHATBOT_API_KEY, CHATBOT_API_URL, CHATBOT_MODEL, CHATBOT_ENABLED, GOOGLE_GEOCODING_API_KEY, geocodeDeliveryBase, signUser, fetchSocialProfile, signInOrCreateSocialUser, sanitizePermissions, hasAdminPermission, ADMIN_PERMISSIONS, getOrderAdmins, createNotification, silenceOrderNotifications, notifyAdmins, notifyOrderCustomer, notifyDeliveryManAssignment, parseCylinderSizeKg, defaultUsageDaysForKg, median, rebuildLpgUsageProfiles, runLpgEmptyReminderChecks, runOrderAlertChecks, sendBulkSmsBdMessage, requireAuth, requireAdminPermission, requireAdminUserManagement, normalizeMongoField, buildMongoQuery, getOptionalAuthUserId, ensureUserOwnedPayload, decorate, upload } = ctx;
app.get('/api/notifications', requireAuth, async (req, res) => {
  try {
    const [notifications, unread_count] = await Promise.all([
      models.notifications
        .find({ user_id: req.auth.id })
        .sort({ created_at: -1 })
        .limit(50)
        .lean(),
      models.notifications.countDocuments({ user_id: req.auth.id, is_read: false }),
    ]);
    res.set('Cache-Control', 'no-store');
    res.json({ data: notifications.map((notification) => ({ ...notification, id: String(notification._id) })), unread_count, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message });
  }
});



app.get('/api/admin/lpg-usage', requireAuth, async (req, res) => {
  try {
    const admin = await getAuthenticatedProfile(req);
    if (!admin?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    await rebuildLpgUsageProfiles();
    const now = new Date();
    const profiles = await models.lpg_usage_profiles.find({ predicted_empty_at: { $ne: null } }).sort({ predicted_empty_at: 1 }).lean();
    const data = await Promise.all(profiles.map(async (usage) => {
      const customer = await models.profiles.findOne({ user_id: usage.user_id }).lean();
      const effectiveEmptyAt = usage.admin_adjusted_empty_at || usage.predicted_empty_at;
      const daysRemaining = Math.ceil((new Date(effectiveEmptyAt).getTime() - now.getTime()) / 86400000);
      return { ...usage, predicted_empty_at: effectiveEmptyAt, system_predicted_empty_at: usage.predicted_empty_at, id: String(usage._id), customer_name: customer?.full_name || 'Customer', customer_phone: customer?.phone || '', days_remaining: daysRemaining, is_admin_adjusted: Boolean(usage.admin_adjusted_empty_at) };
    }));
    res.set('Cache-Control', 'no-store');
    res.json({ data, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.patch('/api/admin/lpg-usage/:id', requireAuth, async (req, res) => {
  try {
    const admin = await getAuthenticatedProfile(req);
    if (!admin?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    const usage = await models.lpg_usage_profiles.findById(String(req.params.id || ''));
    if (!usage) return res.status(404).json({ error: 'Cylinder usage estimate not found.' });
    const rawDate = String(req.body.predicted_empty_at || '').trim();
    const rawDays = req.body.remaining_days;
    let adjusted;
    if (rawDays !== undefined && rawDays !== null && rawDays !== '') {
      const remainingDays = Number(rawDays);
      if (!Number.isInteger(remainingDays) || remainingDays < 0 || remainingDays > 730) {
        return res.status(400).json({ error: 'Remaining days must be a whole number between 0 and 730.' });
      }
      adjusted = new Date();
      adjusted.setDate(adjusted.getDate() + remainingDays);
      adjusted.setHours(23, 59, 59, 999);
    } else {
      if (!rawDate) return res.status(400).json({ error: 'Please select an estimated finish date or enter remaining days.' });
      adjusted = new Date(`${rawDate}T23:59:59.999`);
      if (Number.isNaN(adjusted.getTime())) return res.status(400).json({ error: 'Invalid estimated finish date.' });
    }
    usage.admin_adjusted_empty_at = adjusted;
    usage.admin_adjusted_by = req.auth.id;
    usage.admin_adjusted_at = new Date();
    const leadDays = Math.max(3, Math.min(7, Math.round((usage.average_interval_days || 60) / 10)));
    usage.reminder_at = new Date(adjusted.getTime() - leadDays * 86400000);
    usage.reminder_sent_for_order_id = null;
    usage.updated_at = new Date();
    await usage.save();
    res.json({ data: { ...usage.toJSON(), id: String(usage._id), predicted_empty_at: usage.admin_adjusted_empty_at }, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/admin/lpg-usage/notify', requireAuth, async (req, res) => {
  try {
    const admin = await getAuthenticatedProfile(req);
    if (!admin?.is_admin) return res.status(403).json({ error: 'Administration Head or authorized employee access required.' });
    const usage = await models.lpg_usage_profiles.findById(String(req.body.usage_id || ''));
    if (!usage) return res.status(404).json({ error: 'Cylinder usage estimate not found.' });
    const predicted = new Date(usage.admin_adjusted_empty_at || usage.predicted_empty_at);
    const days = Math.max(0, Math.ceil((predicted.getTime() - Date.now()) / 86400000));
    const title = 'Your LPG cylinder may be nearly empty';
    const message = String(req.body.message || '').trim() || `Your ${usage.cylinder_size_kg}kg LPG cylinder may finish around ${predicted.toLocaleDateString('en-GB')}${days ? ` (about ${days} days remaining)` : ''}. Please order a refill soon.`;
    const notification = await models.notifications.create({ user_id: usage.user_id, type: 'lpg_usage_reminder', title, message, urgent: days <= 3, buzz: true });
    res.status(201).json({ data: { ...notification.toJSON(), id: String(notification._id) }, error: null });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('/api/lpg-usage', requireAuth, async (req, res) => {
  try {
    await rebuildLpgUsageProfiles();
    const now = new Date();
    const profiles = await models.lpg_usage_profiles
      .find({ user_id: req.auth.id, predicted_empty_at: { $ne: null } })
      .sort({ last_order_at: -1 })
      .lean();

    const data = profiles.map((profile) => {
      const startedAt = profile.last_order_at ? new Date(profile.last_order_at) : now;
      const predictedAt = new Date(profile.admin_adjusted_empty_at || profile.predicted_empty_at);
      const totalMs = Math.max(1, predictedAt.getTime() - startedAt.getTime());
      const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
      const usedPercent = Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
      const remainingPercent = Math.max(0, 100 - usedPercent);
      const daysRemaining = Math.max(0, Math.ceil((predictedAt.getTime() - now.getTime()) / 86400000));
      return {
        ...profile,
        predicted_empty_at: profile.admin_adjusted_empty_at || profile.predicted_empty_at,
        system_predicted_empty_at: profile.predicted_empty_at,
        is_admin_adjusted: Boolean(profile.admin_adjusted_empty_at),
        id: String(profile._id),
        used_percent: usedPercent,
        remaining_percent: remainingPercent,
        days_remaining: daysRemaining,
      };
    });

    res.set('Cache-Control', 'no-store');
    res.json({ data, error: null });
  } catch (error) {
    res.status(500).json({ data: null, error: error.message });
  }
});

app.post('/api/notifications/read', requireAuth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    const query = ids.length ? { user_id: req.auth.id, _id: { $in: ids } } : { user_id: req.auth.id, is_read: false };
    await models.notifications.updateMany(query, { $set: { is_read: true, buzz: false, updated_at: new Date() } });
    res.json({ success: true, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/alerts/run', requireAuth, async (req, res) => {
  try {
    const profile = await models.profiles.findOne({ user_id: req.auth.id });
    if (!profile?.is_admin && profile?.role !== 'delivery') {
      return res.status(403).json({ error: 'Admin or delivery user only.' });
    }
    await runOrderAlertChecks();
    res.json({ success: true, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

}
