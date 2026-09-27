# Cylinder Express backend structure

- `index.js` — process entry point and scheduled jobs
- `app.js` — Express application assembly and global middleware
- `config/env.js` — environment loading and configuration
- `models/index.js` — Mongoose schemas and model registry
- `middleware/auth.js` — authentication and management authorization
- `routes/` — feature-specific HTTP route modules
  - `auth.js`
  - `adminAccounts.js`
  - `chatbot.js`
  - `customerChat.js`
  - `deliveryChat.js`
  - `notifications.js`
  - `otp.js`
  - `system.js`
  - `tables.js`
  - `uploads.js`
- `services/runtime.js` — business services for notifications, LPG usage, SMS, chatbot, social login, geocoding, query decoration, and startup maintenance
- `utilities/permissions.js` — permission constants and role helpers
