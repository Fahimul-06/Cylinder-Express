import express from 'express';

export function createRouter(ctx) {
  const router = express.Router();
  const { models, bcrypt, signUser, requireAuth, fetchSocialProfile, signInOrCreateSocialUser, normalizeCustomerPhone, phoneLookupValues } = ctx;
  router.post('/api/auth/signup', async (req, res) => {
    try {
      const { email, password, full_name, phone } = req.body;
      if (!password || !phone || !full_name) return res.status(400).json({ error: 'Name, phone and password are required' });
      if (await models.users.findOne({ $or: [{ email }, { phone }] })) return res.status(409).json({ error: 'Account already exists' });
      const user = await models.users.create({ email, phone, password_hash: await bcrypt.hash(password, 12) });
      await models.profiles.create({
        user_id: user.id,
        full_name,
        phone,
        email,
        is_admin: false,
        role: 'customer',
        permissions: {},
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

  async function findUserForLogin(identifier, { allowEmployeeCode = false } = {}) {
    const value = String(identifier || '').trim().toLowerCase();
    if (!value) return { user: null, profile: null };

    if (allowEmployeeCode && /^\d{6}$/.test(value)) {
      const employeeProfile = await models.profiles.findOne({ employee_code: value, role: 'sub_admin', is_admin: true });
      if (employeeProfile) {
        const employeeUser = await models.users.findById(employeeProfile.user_id);
        if (employeeUser) return { user: employeeUser, profile: employeeProfile };
      }
    }

    const phoneValues = phoneLookupValues(identifier);
    const user = await models.users.findOne({ $or: [{ email: value }, { phone: { $in: phoneValues } }] });
    if (!user) return { user: null, profile: null };
    const profile = await models.profiles.findOne({ user_id: user.id });
    return { user, profile };
  }

  router.post('/api/auth/signin', async (req, res) => {
    try {
      const { emailOrPhone, password } = req.body;
      const { user, profile } = await findUserForLogin(emailOrPhone);
      if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
        return res.status(401).json({ error: 'Invalid login credentials' });
      }
      if (profile?.is_admin || profile?.role === 'admin' || profile?.role === 'sub_admin') {
        return res.status(403).json({ error: 'Administration Head and Employee accounts must use the Management Login page.' });
      }
      if (profile?.role === 'delivery') {
        return res.status(403).json({ error: 'HUB Man accounts must use the HUB Man Login page.' });
      }
      if (profile?.role !== 'customer') {
        return res.status(403).json({ error: 'This account cannot use the Customer Sign In page.' });
      }
      if (profile?.is_active === false) return res.status(403).json({ error: 'This account is inactive. Please contact Customer Care.' });
      const session = signUser(user);
      res.json({ session, user: session.user });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });


  router.post('/api/auth/hub-signin', async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const { user, profile } = await findUserForLogin(identifier);
      if (!user || !profile || !(await bcrypt.compare(password || '', user.password_hash))) {
        return res.status(401).json({ error: 'Invalid HUB Man login credentials' });
      }
      if (profile.role !== 'delivery' || profile.is_admin) {
        return res.status(403).json({ error: 'This login page is only for HUB Man accounts.' });
      }
      if (profile.is_active === false) {
        return res.status(403).json({ error: 'This HUB Man account is inactive. Please contact the Administration Head.' });
      }
      const session = signUser(user);
      res.json({ session, user: session.user, profile: { role: profile.role, is_admin: profile.is_admin } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/api/auth/management-signin', async (req, res) => {
    try {
      const { identifier, password } = req.body;
      const { user, profile } = await findUserForLogin(identifier, { allowEmployeeCode: true });
      if (!user || !profile || !(await bcrypt.compare(password || '', user.password_hash))) {
        return res.status(401).json({ error: 'Invalid management login credentials' });
      }
      if (!profile.is_admin || !['admin', 'sub_admin'].includes(profile.role)) {
        return res.status(403).json({ error: 'This login page is only for the Administration Head and Employees.' });
      }
      if (profile.is_active === false) return res.status(403).json({ error: 'This employee account is inactive. Please contact the Administration Head.' });
      const session = signUser(user);
      res.json({ session, user: session.user, profile: { role: profile.role, is_admin: profile.is_admin, employee_code: profile.employee_code || null } });
    } catch (error) { res.status(500).json({ error: error.message }); }
  });

  router.post('/api/auth/social', async (req, res) => {
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

  router.get('/api/auth/session', requireAuth, async (req, res) => {
    const user = await models.users.findById(req.auth.id);
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ session: signUser(user) });
  });

  router.patch('/api/auth/user', requireAuth, async (req, res) => {
    const update = {};
    if (req.body.email) update.email = String(req.body.email).toLowerCase();
    if (req.body.password) update.password_hash = await bcrypt.hash(req.body.password, 12);
    const user = await models.users.findByIdAndUpdate(req.auth.id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const session = signUser(user);
    res.json({ session, user: session.user });
  });

  router.post('/api/rpc/get_email_by_phone', async (req, res) => {
    const profile = await models.profiles.findOne({ phone: req.body.p_phone });
    res.json({ data: profile?.email || null, error: null });
  });


  return router;
}
