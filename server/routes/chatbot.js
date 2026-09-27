import express from 'express';

export function createRouter(ctx) {
  const router = express.Router();
  const { requireAuth, getAuthenticatedProfile, chatbotEmergencyReply, localChatbotReply, models, CHATBOT_ENABLED, CHATBOT_API_URL, CHATBOT_API_KEY, CHATBOT_MODEL } = ctx;
  router.post('/api/customer-chatbot/respond', requireAuth, async (req, res) => {
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

  return router;
}
