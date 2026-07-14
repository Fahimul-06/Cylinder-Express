export function registerAuthRoutes(ctx) {
  const { app, models, mongoose, bcrypt, jwt, crypto, multer, path, rootDir, JWT_SECRET, SMS_ENABLED, BULKSMSBD_API_URL, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, CHATBOT_API_KEY, CHATBOT_API_URL, CHATBOT_MODEL, CHATBOT_ENABLED, GOOGLE_GEOCODING_API_KEY, geocodeDeliveryBase, signUser, fetchSocialProfile, signInOrCreateSocialUser, sanitizePermissions, hasAdminPermission, ADMIN_PERMISSIONS, getOrderAdmins, createNotification, silenceOrderNotifications, notifyAdmins, notifyOrderCustomer, notifyDeliveryManAssignment, parseCylinderSizeKg, defaultUsageDaysForKg, median, rebuildLpgUsageProfiles, runLpgEmptyReminderChecks, runOrderAlertChecks, sendBulkSmsBdMessage, requireAuth, requireAdminPermission, requireAdminUserManagement, normalizeMongoField, buildMongoQuery, getOptionalAuthUserId, ensureUserOwnedPayload, decorate, upload } = ctx;
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, full_name, phone } = req.body;
    if (!password || !phone || !full_name) return res.status(400).json({ error: 'Name, phone and password are required' });
    if (await models.users.findOne({ $or: [{ email }, { phone }] })) return res.status(409).json({ error: 'Account already exists' });
    const user = await models.users.create({ email, phone, password_hash: await bcrypt.hash(password, 12) });
    const existingProfiles = await models.profiles.countDocuments();
    await models.profiles.create({
      user_id: user.id,
      full_name,
      phone,
      email,
      is_admin: existingProfiles === 0,
      role: existingProfiles === 0 ? 'admin' : 'customer',
      permissions: existingProfiles === 0 ? sanitizePermissions(Object.fromEntries(ADMIN_PERMISSIONS.map((key) => [key, true]))) : {},
      is_active: true,
    });
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

async function generateUniqueEmployeeCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    if (!(await models.profiles.exists({ employee_code: code }))) return code;
  }
  throw new Error('Could not generate a unique employee code.');
}

app.post('/api/auth/signin', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    const value = String(emailOrPhone || '').trim().toLowerCase();
    const phoneValues = phoneLookupValues(emailOrPhone);
    let user = null;
    if (/^\d{6}$/.test(value)) {
      const employeeProfile = await models.profiles.findOne({ employee_code: value, role: 'sub_admin' });
      if (employeeProfile) user = await models.users.findById(employeeProfile.user_id);
    }
    if (!user) user = await models.users.findOne({ $or: [{ email: value }, { phone: { $in: phoneValues } }] });
    if (!user || !(await bcrypt.compare(password || '', user.password_hash))) return res.status(401).json({ error: 'Invalid login credentials' });
    const profile = await models.profiles.findOne({ user_id: user.id });
    if (profile?.is_active === false) return res.status(403).json({ error: 'This account is inactive. Please contact the Administration Head.' });
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/auth/social', async (req, res) => {
  try {
    const provider = String(req.body.provider || '').toLowerCase();
    const accessToken = String(req.body.accessToken || '');
    const socialProfile = await fetchSocialProfile(provider, accessToken);
    const user = await signInOrCreateSocialUser(socialProfile);
    const session = signUser(user);
    res.json({ session, user: session.user });
  } catch (error) {
    res.status(error.statusCode || 401).json({ error: error.message || 'Social login failed' });
  }
});

app.get('/api/auth/session', requireAuth, async (req, res) => {
  const user = await models.users.findById(req.auth.id);
  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ session: signUser(user) });
});

app.patch('/api/auth/user', requireAuth, async (req, res) => {
  const update = {};
  if (req.body.email) update.email = String(req.body.email).toLowerCase();
  if (req.body.password) update.password_hash = await bcrypt.hash(req.body.password, 12);
  const user = await models.users.findByIdAndUpdate(req.auth.id, update, { new: true });
  if (!user) return res.status(404).json({ error: 'User not found' });
  const session = signUser(user);
  res.json({ session, user: session.user });
});

app.post('/api/rpc/get_email_by_phone', async (req, res) => {
  const profile = await models.profiles.findOne({ phone: req.body.p_phone });
  res.json({ data: profile?.email || null, error: null });
});


app.post('/api/admin/subadmins', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const { full_name, employee_position, phone, password, permissions = {} } = req.body;
    if (!full_name || !employee_position || !phone || !password) return res.status(400).json({ error: 'Employee name, position, phone and password are required.' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const normalizedPhone = normalizePhoneForSms(phone);
    const email = `${normalizedPhone}@subadmin.cylinderexpress.bd`;
    if (await models.users.findOne({ $or: [{ phone: { $in: phoneLookupValues(phone) } }, { email }] })) {
      return res.status(409).json({ error: 'A user with this phone already exists.' });
    }

    const employeeCode = await generateUniqueEmployeeCode();
    const user = await models.users.create({ email, phone: normalizedPhone, password_hash: await bcrypt.hash(password, 12) });
    const profile = await models.profiles.create({
      user_id: user.id,
      full_name,
      phone: normalizedPhone,
      email,
      is_admin: true,
      role: 'sub_admin',
      permissions: sanitizePermissions(permissions),
      employee_position: String(employee_position).trim(),
      employee_code: employeeCode,
      is_active: true,
    });

    const smsMessage = `Cylinder Express employee account created. Employee Code: ${employeeCode}. Password: ${password}. You can login with the 6-digit code and password.`;
    let sms = { sent: false, skipped: true, reason: SMS_ENABLED ? 'SMS provider failed' : 'SMS environment variables missing' };
    try {
      sms = await sendBulkSmsBdMessage(normalizedPhone, smsMessage);
    } catch (smsError) {
      sms = { sent: false, skipped: false, error: smsError.message };
      console.error('Employee credential SMS failed:', smsError.message);
    }

    res.json({ data: profile.toJSON(), sms, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/admin/delivery-men', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const { full_name, phone, password, permanent_address, permanent_plus_code, permanent_latitude, permanent_longitude } = req.body;
    if (!full_name || !phone || !password) return res.status(400).json({ error: 'Name, phone and password are required.' });
    const hasLat = permanent_latitude !== undefined && permanent_latitude !== null && String(permanent_latitude).trim() !== '';
    const hasLng = permanent_longitude !== undefined && permanent_longitude !== null && String(permanent_longitude).trim() !== '';
    if (hasLat !== hasLng) return res.status(400).json({ error: 'Both latitude and longitude are required.' });
    if (!String(permanent_address || '').trim() && !String(permanent_plus_code || '').trim() && !hasLat) {
      return res.status(400).json({ error: 'A delivery base address, Plus Code, or coordinates are required.' });
    }
    const manualLat = hasLat ? Number(permanent_latitude) : null;
    const manualLng = hasLng ? Number(permanent_longitude) : null;
    if (hasLat && (!Number.isFinite(manualLat) || manualLat < -90 || manualLat > 90 || !Number.isFinite(manualLng) || manualLng < -180 || manualLng > 180)) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90, and longitude between -180 and 180.' });
    }
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    const normalizedPhone = normalizePhoneForSms(phone);
    const email = `${normalizedPhone}@delivery.cylinderexpress.bd`;
    if (await models.users.findOne({ $or: [{ phone: { $in: phoneLookupValues(phone) } }, { email }] })) {
      return res.status(409).json({ error: 'A user with this phone already exists.' });
    }

    const basePoint = hasLat ? { latitude: manualLat, longitude: manualLng, formattedAddress: permanent_address || permanent_plus_code || `Base point (${manualLat}, ${manualLng})` } : await geocodeDeliveryBase(permanent_address, permanent_plus_code);
    const user = await models.users.create({ email, phone: normalizedPhone, password_hash: await bcrypt.hash(password, 12) });
    const profile = await models.profiles.create({
      user_id: user.id,
      full_name,
      phone: normalizedPhone,
      email,
      is_admin: false,
      role: 'delivery',
      permissions: {},
      is_active: true,
      permanent_address: basePoint?.formattedAddress || permanent_address || null,
      permanent_latitude: basePoint?.latitude ?? null,
      permanent_longitude: basePoint?.longitude ?? null,
      permanent_plus_code: permanent_plus_code ? String(permanent_plus_code).trim() : null,
    });

    const smsMessage = `Cylinder Express delivery account created. Username: ${normalizedPhone}. Password: ${password}. Login and share your live location before delivery.`;
    let sms = { sent: false, skipped: true, reason: SMS_ENABLED ? 'SMS provider failed' : 'SMS environment variables missing' };
    try {
      sms = await sendBulkSmsBdMessage(normalizedPhone, smsMessage);
    } catch (smsError) {
      sms = { sent: false, skipped: false, error: smsError.message };
      console.error('Delivery credential SMS failed:', smsError.message);
    }

    res.json({ data: profile.toJSON(), sms, error: null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});


app.patch('/api/admin/delivery-men/:profileId', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
    const baseChanged = req.body.permanent_address !== undefined || req.body.permanent_plus_code !== undefined || req.body.permanent_latitude !== undefined || req.body.permanent_longitude !== undefined;
    if (baseChanged) {
      const existing = await models.profiles.findOne({ _id: req.params.profileId, role: 'delivery' }).lean();
      if (!existing) return res.status(404).json({ error: 'HUB Man profile not found.' });
      const nextAddress = req.body.permanent_address !== undefined ? req.body.permanent_address : existing.permanent_address;
      const nextPlusCode = req.body.permanent_plus_code !== undefined ? req.body.permanent_plus_code : existing.permanent_plus_code;
      const nextLatRaw = req.body.permanent_latitude !== undefined ? req.body.permanent_latitude : existing.permanent_latitude;
      const nextLngRaw = req.body.permanent_longitude !== undefined ? req.body.permanent_longitude : existing.permanent_longitude;
      const hasLat = nextLatRaw !== undefined && nextLatRaw !== null && String(nextLatRaw).trim() !== '';
      const hasLng = nextLngRaw !== undefined && nextLngRaw !== null && String(nextLngRaw).trim() !== '';
      if (hasLat !== hasLng) return res.status(400).json({ error: 'Both latitude and longitude are required.' });
      if (!String(nextAddress || '').trim() && !String(nextPlusCode || '').trim() && !hasLat) {
        return res.status(400).json({ error: 'A delivery base address, Plus Code, or coordinates are required.' });
      }
      const manualLat = hasLat ? Number(nextLatRaw) : null;
      const manualLng = hasLng ? Number(nextLngRaw) : null;
      if (hasLat && (!Number.isFinite(manualLat) || manualLat < -90 || manualLat > 90 || !Number.isFinite(manualLng) || manualLng < -180 || manualLng > 180)) {
        return res.status(400).json({ error: 'Latitude must be between -90 and 90, and longitude between -180 and 180.' });
      }
      const basePoint = hasLat ? { latitude: manualLat, longitude: manualLng, formattedAddress: nextAddress || nextPlusCode || `Base point (${manualLat}, ${manualLng})` } : await geocodeDeliveryBase(nextAddress, nextPlusCode);
      update.permanent_address = basePoint?.formattedAddress || nextAddress || null;
      update.permanent_plus_code = nextPlusCode ? String(nextPlusCode).trim() : null;
      update.permanent_latitude = basePoint?.latitude ?? null;
      update.permanent_longitude = basePoint?.longitude ?? null;
    }
    update.updated_at = new Date();
    const profile = await models.profiles.findOneAndUpdate({ _id: req.params.profileId, role: 'delivery' }, update, { new: true });
    if (!profile) return res.status(404).json({ error: 'HUB Man profile not found.' });
    const userUpdate = {};
    if (req.body.phone !== undefined) userUpdate.phone = req.body.phone;
    if (req.body.password) userUpdate.password_hash = await bcrypt.hash(String(req.body.password), 12);
    if (Object.keys(userUpdate).length) await models.users.findByIdAndUpdate(profile.user_id, userUpdate);
    res.json({ data: profile.toJSON(), error: null });
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.patch('/api/admin/subadmins/:profileId', requireAuth, requireAdminUserManagement, async (req, res) => {
  try {
    const update = {};
    if (req.body.full_name !== undefined) update.full_name = req.body.full_name;
    if (req.body.phone !== undefined) update.phone = req.body.phone;
    if (req.body.permissions !== undefined) update.permissions = sanitizePermissions(req.body.permissions);
    if (req.body.employee_position !== undefined) update.employee_position = req.body.employee_position ? String(req.body.employee_position).trim() : null;
    if (req.body.is_active !== undefined) update.is_active = Boolean(req.body.is_active);
    update.updated_at = new Date();
    const profile = await models.profiles.findByIdAndUpdate(req.params.profileId, update, { new: true });
    if (!profile) return res.status(404).json({ error: 'Employee profile not found.' });
    const userUpdate = {};
    if (req.body.phone !== undefined) userUpdate.phone = req.body.phone;
    if (req.body.password) userUpdate.password_hash = await bcrypt.hash(String(req.body.password), 12);
    if (Object.keys(userUpdate).length) await models.users.findByIdAndUpdate(profile.user_id, userUpdate);
    res.json({ data: profile.toJSON(), error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});



app.delete('/api/admin/accounts/:profileId', requireAuth, requireAdminPermission('account_delete'), async (req, res) => {
  try {
    const password = String(req.body?.password || '');
    if (!password) return res.status(400).json({ error: 'Your current password is required to delete an account.' });

    const actorUser = await models.users.findById(req.auth.id);
    if (!actorUser || !(await bcrypt.compare(password, actorUser.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password. Account was not deleted.' });
    }

    const target = await models.profiles.findById(req.params.profileId);
    if (!target) return res.status(404).json({ error: 'Account not found.' });
    if (String(target.user_id) === String(req.auth.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account.' });
    }
    if (target.role === 'admin' || (target.is_admin && target.role !== 'sub_admin')) {
      return res.status(403).json({ error: 'The Administration Head account cannot be deleted here.' });
    }

    const targetUserId = String(target.user_id);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (target.role === 'customer') {
          const customerOrders = await models.orders.find({ user_id: targetUserId }).select('_id').session(session);
          const orderIds = customerOrders.map((o) => String(o._id));
          if (orderIds.length) {
            await models.order_items.deleteMany({ order_id: { $in: orderIds } }, { session });
            await models.notifications.deleteMany({ order_id: { $in: orderIds } }, { session });
          }
          await Promise.all([
            models.orders.deleteMany({ user_id: targetUserId }, { session }),
            models.addresses.deleteMany({ user_id: targetUserId }, { session }),
            models.service_bookings.deleteMany({ user_id: targetUserId }, { session }),
            models.customer_locations.deleteMany({ user_id: targetUserId }, { session }),
            models.customer_location_points.deleteMany({ user_id: targetUserId }, { session }),
            models.customer_admin_messages.deleteMany({ $or: [{ customer_user_id: targetUserId }, { sender_id: targetUserId }] }, { session }),
            models.lpg_usage_profiles.deleteMany({ user_id: targetUserId }, { session }),
            models.notifications.deleteMany({ user_id: targetUserId }, { session }),
          ]);
        } else if (target.role === 'delivery') {
          await models.orders.updateMany({ delivery_man_id: targetUserId, status: { $nin: ['delivered', 'cancelled'] } }, { $set: { delivery_man_id: null, delivery_assigned_at: null, updated_at: new Date() } }, { session });
          await Promise.all([
            models.delivery_locations.deleteMany({ user_id: targetUserId }, { session }),
            models.delivery_location_points.deleteMany({ user_id: targetUserId }, { session }),
            models.delivery_admin_messages.deleteMany({ $or: [{ delivery_user_id: targetUserId }, { sender_id: targetUserId }] }, { session }),
            models.notifications.deleteMany({ user_id: targetUserId }, { session }),
          ]);
        } else if (target.role === 'sub_admin') {
          await Promise.all([
            models.delivery_admin_messages.deleteMany({ sender_id: targetUserId }, { session }),
            models.customer_admin_messages.deleteMany({ sender_id: targetUserId }, { session }),
            models.notifications.deleteMany({ user_id: targetUserId }, { session }),
          ]);
        }

        await models.profiles.deleteOne({ _id: target._id }, { session });
        await models.users.deleteOne({ _id: targetUserId }, { session });
      });
    } finally {
      await session.endSession();
    }

    res.json({ data: { deleted: true, role: target.role, name: target.full_name }, error: null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

}
