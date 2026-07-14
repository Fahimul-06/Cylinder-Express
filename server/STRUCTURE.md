# Backend structure

- `index.js` — minimal server entry point.
- `app.js` — Express application setup, shared models/services, and startup lifecycle.
- `routes/auth.routes.js` — signup, sign-in, social auth, sessions, employees, HUB Men, and secure account deletion.
- `routes/chat.routes.js` — customer chatbot, customer-care messaging, and HUB Man messaging.
- `routes/notification.routes.js` — notifications and LPG usage prediction/administration endpoints.
- `routes/table.routes.js` — generic MongoDB table API used by the frontend.
- `routes/otp.routes.js` — registration OTP, forgot-password OTP, verification, and password reset.
- `routes/upload.routes.js` — MongoDB-backed file upload and asset delivery.

Internal role keys and API URLs were intentionally preserved for backward compatibility.
