export function registerOtpRoutes(ctx) {
  const { app, models, bcrypt, crypto, BULKSMSBD_API_URL, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID } = ctx;
function normalizePhoneForSms(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('880')) return digits;
  if (digits.startsWith('0')) return `88${digits}`;
  if (digits.length === 10 && digits.startsWith('1')) return `880${digits}`;
  return digits;
}

function phoneLookupValues(phone) {
  const raw = String(phone || '').trim();
  const digits = raw.replace(/\D/g, '');
  const normalized = normalizePhoneForSms(raw);
  const local = normalized.startsWith('880') ? `0${normalized.slice(3)}` : digits;
  return Array.from(new Set([raw, digits, normalized, local].filter(Boolean)));
}

function isRealCustomerPhone(phone) {
  if (!phone) return false;
  const value = String(phone).trim();
  if (!value || value.includes(':') || value.includes('@')) return false;
  const digits = value.replace(/\D/g, '');
  return /^01[3-9]\d{8}$/.test(digits) || /^8801[3-9]\d{8}$/.test(digits);
}

function normalizeCustomerPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (/^8801[3-9]\d{8}$/.test(digits)) return `0${digits.slice(3)}`;
  return digits;
}

async function sendBulkSmsBdOtp(phone, otp) {
  return sendBulkSmsBdMessage(phone, `Your Cylinder Express OTP is ${otp}. It will expire in 5 minutes.`);
}

app.post('/functions/v1/send-otp', async (req, res) => {
  try {
    const { phone, purpose } = req.body || {};
    if (!phone) return res.status(400).json({ error: 'Phone number is required.' });

    const normalizedPhone = normalizeCustomerPhone(phone);
    if (!/^01[3-9]\d{8}$/.test(normalizedPhone)) {
      return res.status(400).json({ error: 'Enter a valid Bangladesh mobile number.' });
    }

    if (purpose === 'password-reset') {
      const account = await models.users.findOne({ phone: { $in: phoneLookupValues(normalizedPhone) } });
      if (!account) return res.status(404).json({ error: 'No account found with this phone number.' });
    }

    if (process.env.NODE_ENV === 'production' && !SMS_ENABLED) {
      console.error('OTP SMS is disabled: BULKSMSBD_API_KEY or BULKSMSBD_SENDER_ID is missing.');
      return res.status(503).json({
        error: 'SMS service is not configured. Please contact Cylinder Express support.',
        code: 'SMS_NOT_CONFIGURED',
      });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await models.otp_verifications.deleteMany({ phone: { $in: phoneLookupValues(normalizedPhone) }, used: false });
    await models.otp_verifications.create({ phone: normalizedPhone, otp, expires_at: new Date(Date.now() + 5 * 60 * 1000) });

    const smsResult = await sendBulkSmsBdOtp(normalizedPhone, otp);
    if (process.env.NODE_ENV !== 'production') console.log(`Cylinder Express OTP for ${normalizedPhone}: ${otp}`);
    return res.json({
      success: true,
      message: smsResult.sent ? 'OTP sent successfully' : 'Development OTP generated',
      ...(process.env.NODE_ENV !== 'production' ? { otp } : {}),
    });
  } catch (error) {
    console.error('OTP SMS sending failed:', error);
    return res.status(502).json({
      error: 'OTP could not be sent. Check the SMS configuration and try again.',
      code: 'OTP_SEND_FAILED',
    });
  }
});

app.post('/functions/v1/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  const record = await models.otp_verifications.findOne({ phone, used: false }).sort({ created_at: -1 });
  if (!record) return res.status(400).json({ error: 'No OTP found for this number. Please request a new one.' });
  if (record.expires_at < new Date()) return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  if (record.otp !== String(otp).trim()) return res.status(400).json({ error: 'Invalid OTP. Please check and try again.' });
  record.used = true; await record.save();
  res.json({ success: true, message: 'Phone verified successfully' });
});

app.post('/functions/v1/verify-reset-otp', async (req, res) => {
  const { phone, otp } = req.body || {};
  const normalizedPhone = normalizeCustomerPhone(phone);
  const record = await models.otp_verifications.findOne({
    phone: { $in: phoneLookupValues(normalizedPhone) },
    used: false,
  }).sort({ created_at: -1 });
  if (!record || record.otp !== String(otp || '').trim() || record.expires_at < new Date()) {
    return res.status(400).json({ error: 'Invalid or expired OTP.' });
  }
  record.used = true;
  await record.save();
  const token = crypto.randomUUID();
  await models.password_reset_sessions.create({
    phone: normalizedPhone,
    token,
    expires_at: new Date(Date.now() + 15 * 60 * 1000),
  });
  res.json({ success: true, reset_token: token });
});

app.post('/functions/v1/reset-password', async (req, res) => {
  const { phone, reset_token, new_password } = req.body || {};
  const normalizedPhone = normalizeCustomerPhone(phone);
  if (!new_password || String(new_password).length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  const session = await models.password_reset_sessions.findOne({
    phone: { $in: phoneLookupValues(normalizedPhone) },
    token: reset_token,
    used: false,
  });
  if (!session || session.expires_at < new Date()) return res.status(400).json({ error: 'Invalid or expired reset token.' });
  const user = await models.users.findOne({ phone: { $in: phoneLookupValues(normalizedPhone) } });
  if (!user) return res.status(404).json({ error: 'No account found with this phone number.' });
  user.password_hash = await bcrypt.hash(new_password, 12);
  await user.save();
  session.used = true;
  await session.save();
  res.json({ success: true, message: 'Password updated successfully' });
});


}
