export function registerChatRoutes(ctx) {
  const { app, models, mongoose, bcrypt, jwt, crypto, multer, path, rootDir, JWT_SECRET, SMS_ENABLED, BULKSMSBD_API_URL, BULKSMSBD_API_KEY, BULKSMSBD_SENDER_ID, CHATBOT_API_KEY, CHATBOT_API_URL, CHATBOT_MODEL, CHATBOT_ENABLED, GOOGLE_GEOCODING_API_KEY, geocodeDeliveryBase, signUser, fetchSocialProfile, signInOrCreateSocialUser, sanitizePermissions, hasAdminPermission, ADMIN_PERMISSIONS, getOrderAdmins, createNotification, silenceOrderNotifications, notifyAdmins, notifyOrderCustomer, notifyDeliveryManAssignment, parseCylinderSizeKg, defaultUsageDaysForKg, median, rebuildLpgUsageProfiles, runLpgEmptyReminderChecks, runOrderAlertChecks, sendBulkSmsBdMessage, requireAuth, requireAdminPermission, requireAdminUserManagement, normalizeMongoField, buildMongoQuery, getOptionalAuthUserId, ensureUserOwnedPayload, decorate, upload } = ctx;
app.get('/api/admin/sms-status', requireAuth, requireAdminUserManagement, (_req, res) => {
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



async function getAuthenticatedProfile(req) {
  return models.profiles.findOne({ user_id: req.auth.id });
}



function chatbotEmergencyReply(message, language = 'en') {
  const q = String(message || '').toLowerCase();
  const leak = /gas.{0,12}(leak|smell|odor|gondho)|(?:leak|smell|odor|gondho).{0,12}gas|গ্যাস.{0,12}(লিক|গন্ধ)|(?:লিক|গন্ধ).{0,12}গ্যাস/.test(q);
  if (!leak) return null;
  return language === 'bn'
    ? '⚠️ গ্যাস লিক বা গ্যাসের গন্ধ পেলে এখনই আগুন, ম্যাচ, লাইটার ও সিগারেট বন্ধ করুন। কোনো বৈদ্যুতিক সুইচ, ফ্যান, চার্জার বা যন্ত্র চালু/বন্ধ করবেন না। নিরাপদ হলে চুলার নব ও রেগুলেটর বন্ধ করুন, দরজা-জানালা হাতে খুলুন, সবাইকে বাইরে নিয়ে যান এবং বাইরে থেকে 999 বা Cylinder Express কাস্টমার কেয়ারে কল করুন। নিজে মেরামত করবেন না এবং প্রশিক্ষিত টেকনিশিয়ান পরীক্ষা না করা পর্যন্ত আবার ব্যবহার করবেন না।'
    : '⚠️ If you smell gas or suspect an LPG leak, extinguish flames, matches, lighters, and cigarettes immediately. Do not operate electrical switches, fans, chargers, or appliances. If safe, close the stove knobs and regulator, open doors and windows manually, move everyone outside, and call 999 or Cylinder Express support from outdoors. Do not repair or reuse the system until a trained technician has inspected it.';
}

function normalizeChatText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9\u0980-\u09ff\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function localChatbotReply(message, language = 'en') {
  const q = normalizeChatText(message);
  const bn = language === 'bn' || /[\u0980-\u09ff]/.test(q);
  const has = (...terms) => terms.some((term) => q.includes(term));

  if (has('price', 'cost', 'dam', 'দাম', 'মূল্য')) {
    return bn
      ? 'বর্তমান দাম দেখতে Products পেজে নির্দিষ্ট সিলিন্ডার বা পণ্যটি খুলুন। রিফিলে শুধু গ্যাসের দাম এবং নতুন সিলিন্ডারে গ্যাসের দাম + বোতলের দাম যোগ হয়। নির্দিষ্ট ব্র্যান্ড ও কেজি লিখলে আমি আরও নির্দিষ্টভাবে সাহায্য করব।'
      : 'Open the specific cylinder or item on the Products page for its current price. Refill charges only the gas price; a new cylinder charges gas price plus bottle price. Tell me the brand and cylinder size for more specific guidance.';
  }
  if (has('family', 'member', 'people', 'person', 'পরিবার', 'জন', 'সদস্য', 'বার রান্না', 'times cook', 'meal')) {
    return bn
      ? 'সঠিক সাইজ বাছাই করতে পরিবারের সদস্য সংখ্যা, দিনে কতবার রান্না করেন এবং প্রতি বেলায় আনুমানিক কয়টি পদ রান্না হয় লিখুন। সাধারণভাবে হালকা ব্যবহারে ৫–৬ কেজি, অধিকাংশ পরিবারের জন্য ১২–১২.৫ কেজি, এবং বেশি/দীর্ঘ রান্নায় ২২ কেজি বা বড় সাইজ প্রয়োজন হতে পারে। এটি আনুমানিক—চুলার দক্ষতা ও রান্নার ধরনেও ব্যবহার বদলায়।'
      : 'For a useful size estimate, tell me the number of family members, cooking sessions per day, and approximate dishes per session. As a rough guide: 5–6 kg suits light use, 12–12.5 kg suits many households, and 22 kg or larger may suit heavier or longer cooking. Actual usage varies by burner efficiency and cooking style.';
  }
  if (has('save gas', 'less gas', 'gas kom', 'সাশ্রয়', 'কম খরচ', 'গ্যাস বাঁচ')) {
    return bn
      ? 'গ্যাস সাশ্রয়ে ঢাকনা দিয়ে রান্না করুন, প্রয়োজনমতো শিখা কমান, বার্নারের ছিদ্র পরিষ্কার রাখুন, উপকরণ আগে প্রস্তুত করুন, উপযুক্ত আকারের হাঁড়ি ব্যবহার করুন এবং অপ্রয়োজনে চুলা জ্বালিয়ে রাখবেন না। হলুদ শিখা বা অস্বাভাবিক গন্ধ হলে ব্যবহার বন্ধ করে টেকনিশিয়ান দেখান।'
      : 'To save gas, cook with lids, lower the flame after boiling starts, keep burner ports clean, prepare ingredients before lighting the stove, use correctly sized cookware, and never leave the burner on unnecessarily. Stop use and arrange inspection if the flame is yellow or there is an unusual smell.';
  }
  if (has('fast finish', 'finished fast', 'quickly empty', 'taratari sesh', 'দ্রুত শেষ', 'তাড়াতাড়ি শেষ')) {
    return bn
      ? 'সিলিন্ডার দ্রুত শেষ হওয়ার কারণ হতে পারে বেশি রান্না, বড় শিখা, বার্নার/রেগুলেটরের সমস্যা, পাইপ বা সংযোগে লিক, অথবা আগের তুলনায় বেশি ব্যবহার। আগুন দিয়ে কখনো লিক পরীক্ষা করবেন না; সাবান-পানির বুদবুদ পরীক্ষাও প্রশিক্ষিত টেকনিশিয়ান দিয়ে করানো নিরাপদ। সন্দেহ হলে ব্যবহার বন্ধ করে সার্ভিস বুক করুন।'
      : 'A cylinder may finish quickly because of heavier cooking, unnecessarily high flame, burner/regulator problems, a hose or connection leak, or increased household use. Never test leaks with fire. Stop using the system and book a technician inspection if usage changed suddenly or a leak is suspected.';
  }
  if (has('yellow flame', 'orange flame', 'black pot', 'soot', 'holud agun', 'হলুদ আগুন', 'হাঁড়ি কালো', 'কালো হয়')) {
    return bn
      ? 'হলুদ/কমলা শিখা বা হাঁড়ি কালো হওয়া সাধারণত অসম্পূর্ণ দহন, নোংরা বার্নার বা বাতাসের অনুপাতের সমস্যার লক্ষণ। চুলা বন্ধ করুন, ঠান্ডা হলে বার্নার পরিষ্কার করুন; সমস্যা থাকলে নিজে খুলে মেরামত না করে টেকনিশিয়ান ডাকুন।'
      : 'A yellow/orange flame or black soot usually indicates incomplete combustion, blocked burner ports, or an air-mix problem. Turn the stove off, clean the burner only after it is cool, and arrange a technician inspection if the problem continues.';
  }
  if (has('regulator', 'pipe', 'hose', 'valve', 'burner', 'stove', 'রেগুলেটর', 'পাইপ', 'ভালভ', 'বার্নার', 'চুলা')) {
    return bn
      ? 'রেগুলেটর, পাইপ, ভালভ, বার্নার বা চুলার সমস্যা হলে গ্যাস সরবরাহ বন্ধ করুন এবং নিজে পরিবর্তন বা মেরামত করবেন না। Products পেজে উপযুক্ত পণ্য দেখতে পারেন, অথবা Services পেজ থেকে ইনস্টলেশন/পরিদর্শন বুক করুন। সমস্যা ও পণ্যের নাম লিখলে আমি ধাপে ধাপে নিরাপদ নির্দেশনা দেব।'
      : 'For regulator, hose, valve, burner, or stove problems, shut off the gas supply and do not modify or repair the equipment yourself. Check compatible items on Products or book installation/inspection from Services. Describe the exact symptom and product for safer step-by-step guidance.';
  }
  if (has('order', 'delivery', 'track', 'কর্ডার', 'অর্ডার', 'ডেলিভারি', 'ট্র্যাক')) {
    return bn
      ? 'Profile Settings → My Orders থেকে অর্ডারের অবস্থা ও ডেলিভারি ট্র্যাকিং দেখুন। ব্যক্তিগত অর্ডারের তথ্য নিরাপত্তার কারণে চ্যাটবট সরাসরি দেখায় না। অর্ডার নম্বরসহ Customer Care-এ লিখলে Administration Head বা অনুমোদিত কর্মী উত্তর দিতে পারবেন।'
      : 'Open Profile Settings → My Orders to see order status and delivery tracking. For privacy, the chatbot does not expose personal order details directly. Send the order number in this chat so Customer Care staff can review it.';
  }
  if (has('address', 'location', 'ঠিকানা', 'লোকেশন')) {
    return bn
      ? 'Profile Settings → Delivery Addresses থেকে ঠিকানা যোগ বা পরিবর্তন করুন। ডিভাইস লোকেশন দিলে অ্যাপ স্থানটির নাম দেখাবে এবং অক্ষাংশ/দ্রাঘিমাংশ শুধু ডেলিভারি হিসাবের জন্য ভিতরে সংরক্ষিত থাকবে।'
      : 'Use Profile Settings → Delivery Addresses to add or edit an address. When device location is shared, the app displays the place name while coordinates remain internal for delivery calculations.';
  }
  if (has('password', 'otp', 'login', 'forgot', 'পাসওয়ার্ড', 'ওটিপি', 'লগইন')) {
    return bn
      ? 'Login পেজের Forgot Password অপশন ব্যবহার করুন। নিবন্ধিত ফোন নম্বরে OTP না এলে নম্বরটি 01XXXXXXXXX ফরম্যাটে দিন, নেটওয়ার্ক পরীক্ষা করুন এবং কিছুক্ষণ পর আবার চেষ্টা করুন। তবুও না এলে Customer Care-এ ফোন নম্বরের শেষ ৪ সংখ্যা লিখুন—সম্পূর্ণ পাসওয়ার্ড বা OTP কখনো পাঠাবেন না।'
      : 'Use Forgot Password on the Login page. If the OTP does not arrive, enter the registered number in 01XXXXXXXXX format, check network coverage, and retry shortly. If it still fails, send only the last four phone digits to Customer Care—never share a password or OTP.';
  }
  if (has('hello', 'hi', 'hey', 'salam', 'হ্যালো', 'হাই', 'আসসালাম')) {
    return bn
      ? 'স্বাগতম! LPG সিলিন্ডার, রান্না, সাইজ নির্বাচন, গ্যাস সাশ্রয়, পণ্য, অর্ডার, ডেলিভারি বা সার্ভিস—যে বিষয়ে সাহায্য চান স্বাভাবিকভাবে লিখুন।'
      : 'Welcome! Ask naturally about LPG cylinders, cooking, size selection, gas saving, products, orders, delivery, or services.';
  }

  return bn
    ? 'আপনার প্রশ্নটি পেয়েছি। এই বিষয়ে নিশ্চিত স্বয়ংক্রিয় উত্তর না থাকায় আমি ভুল তথ্য দিতে চাই না। সমস্যাটি একটু বিস্তারিত লিখুন—কোন পণ্য/সিলিন্ডার, কী লক্ষণ, কখন থেকে, এবং আপনি কী জানতে চান। আপনার বার্তাটি Customer Care-ও দেখতে পাবে এবং প্রয়োজন হলে উত্তর দেবে। জরুরি গ্যাসের গন্ধ বা লিক হলে বৈদ্যুতিক সুইচ ব্যবহার না করে সবাইকে বাইরে নিয়ে 999 বা 01967517077 / 01409472939 নম্বরে বাইরে থেকে কল করুন।'
    : 'I received your question. I do not have a reliable automatic answer for that exact issue, so I will not guess. Please add the product/cylinder involved, the exact symptom, when it started, and what you need to know. Customer Care staff can also see this message and reply. For a gas smell or suspected leak, do not operate electrical switches; move everyone outside and call 999 or 01967517077 / 01409472939 from outdoors.';
}

app.post('/api/customer-chatbot/respond', requireAuth, async (req, res) => {
  try {
    const profile = await getAuthenticatedProfile(req);
    if (!profile || profile.role === 'delivery' || profile.is_admin) {
      return res.status(403).json({ error: 'Customer access required.' });
    }
    const message = String(req.body.message || '').trim();
    const language = req.body.language === 'bn' ? 'bn' : 'en';
    if (!message) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message is too long.' });

    const emergency = chatbotEmergencyReply(message, language);
    if (emergency) return res.json({ data: { reply: emergency, source: 'safety' }, error: null });
    if (!CHATBOT_ENABLED) {
      return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
    }

    const history = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];
    const products = await models.products.find({ is_available: { $ne: false } })
      .select('name type company_name size price gas_price bottle_price description')
      .sort({ sort_order: 1 }).limit(40).lean();
    const catalog = products.map((item) => {
      const parts = [item.name, item.company_name, item.size, item.type].filter(Boolean).join(' | ');
      const gas = item.gas_price ?? item.price;
      const bottle = item.bottle_price;
      const priceText = bottle != null ? `gas/refill ${gas} BDT, bottle ${bottle} BDT, new total ${Number(gas || 0) + Number(bottle || 0)} BDT` : `price ${item.price} BDT`;
      return `- ${parts}: ${priceText}${item.description ? `; ${String(item.description).slice(0, 120)}` : ''}`;
    }).join('\n');

    const system = `You are the Cylinder Express customer-care chatbot for an LPG ordering and service web app in Bangladesh. Reply in ${language === 'bn' ? 'natural Bangla' : 'clear English'}, matching the customer's wording when they mix Bangla and English. Understand spelling mistakes, Banglish, incomplete questions, and different sentence structures.

You may answer broadly about LPG cylinders, refill vs new cylinder, cylinder-size selection, cooking habits, gas saving, stove/burner/regulator/hose/valve issues, safe installation, products, prices from the supplied catalog, ordering, cart, addresses, delivery tracking, services, account/login, and Cylinder Express usage. Ask one concise follow-up only when essential information is missing. Never invent stock, price, delivery time, order status, or company policy. For personal order/account status, tell the customer to open the relevant app page or contact Customer Care.

Safety rules: For suspected gas leaks, fire, dizziness, breathing difficulty, or poisoning, prioritize immediate emergency safety. Never advise testing a leak with fire, opening electrical switches, repairing a cylinder, transferring gas, heating a cylinder, or bypassing a regulator. Say estimates are approximate when recommending cylinder size or duration.

Useful app facts:
- Refill price is gas price only. New cylinder price is gas price plus bottle price.
- Customers choose New Cylinder or Refill on the LPG product-detail page.
- Orders are available from Profile Settings > My Orders.
- Addresses are available from Profile Settings > Delivery Addresses.
- Cylinder Usage shows estimated finish date and remaining days.
- Direct support numbers: 01967517077 and 01409472939.

Current product catalog:
${catalog || '- Catalog unavailable; do not invent current prices.'}

Keep replies useful and concise, normally under 180 words. Do not claim to be a human.`;

    const messages = [
      { role: 'system', content: system },
      ...history.filter((item) => item && ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
        .map((item) => ({ role: item.role, content: item.content.slice(0, 2000) })),
      { role: 'user', content: message },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(CHATBOT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CHATBOT_API_KEY}` },
        body: JSON.stringify({ model: CHATBOT_MODEL, messages, temperature: 0.25, max_tokens: 450 }),
        signal: controller.signal,
      });
    } finally { clearTimeout(timeout); }

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error('Chatbot provider error:', response.status, detail.slice(0, 500));
      return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
    }
    const payload = await response.json();
    const reply = String(payload?.choices?.[0]?.message?.content || '').trim();
    if (!reply) return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
    return res.json({ data: { reply, source: 'ai' }, error: null });
  } catch (error) {
    const language = req.body?.language === 'bn' ? 'bn' : 'en';
    const message = String(req.body?.message || '').trim();
    console.error('Chatbot response fallback:', error?.message || error);
    return res.json({ data: { reply: localChatbotReply(message, language), source: 'local' }, error: null });
  }
});

app.get('/api/customer-chat/conversations', requireAuth, async (req, res) => {
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

app.get('/api/customer-chat/messages', requireAuth, async (req, res) => {
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

app.post('/api/customer-chat/messages', requireAuth, async (req, res) => {
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

app.post('/api/customer-chat/read', requireAuth, async (req, res) => {
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

app.get('/api/delivery-chat/conversations', requireAuth, async (req, res) => {
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

app.get('/api/delivery-chat/messages', requireAuth, async (req, res) => {
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

app.post('/api/delivery-chat/messages', requireAuth, async (req, res) => {
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

app.post('/api/delivery-chat/read', requireAuth, async (req, res) => {
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

}
