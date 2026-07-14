import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const uploadsDir = path.join(rootDir, 'uploads');
const distDir = path.join(rootDir, 'dist');

fs.mkdirSync(uploadsDir, { recursive: true });

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-before-production';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123456';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/portfolio_mongodb';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const CALL_ENABLED = String(process.env.CALL_ENABLED || 'true') === 'true';
const ICE_SERVERS_JSON = process.env.ICE_SERVERS_JSON || '';
const STUN_URLS = process.env.STUN_URLS || 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302';
const TURN_URLS = process.env.TURN_URLS || '';
const TURN_USERNAME = process.env.TURN_USERNAME || '';
const TURN_CREDENTIAL = process.env.TURN_CREDENTIAL || '';
const CALL_RING_ENABLED = String(process.env.CALL_RING_ENABLED || 'true') === 'true';
const CALL_RING_VOLUME = Number(process.env.CALL_RING_VOLUME || '1');
const CALL_RING_FREQUENCY = Number(process.env.CALL_RING_FREQUENCY || '950');
const CALL_RING_INTERVAL_MS = Number(process.env.CALL_RING_INTERVAL_MS || '1200');
const CALL_RING_BEEP_MS = Number(process.env.CALL_RING_BEEP_MS || '700');
const CALL_VIBRATION_ENABLED = String(process.env.CALL_VIBRATION_ENABLED || 'true') === 'true';
const CALL_AUTO_OPEN_INCOMING_PAGE = String(process.env.CALL_AUTO_OPEN_INCOMING_PAGE || 'true') === 'true';
const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
const BULKSMSBD_API_KEY = process.env.BULKSMSBD_API_KEY || '';
const BULKSMSBD_SENDER_ID = process.env.BULKSMSBD_SENDER_ID || '';
const BULKSMSBD_TYPE = process.env.BULKSMSBD_TYPE || 'text';
const BULKSMSBD_ENDPOINT = process.env.BULKSMSBD_ENDPOINT || 'https://bulksmsbd.net/api/smsapi';
const CALL_SMS_TEXT = process.env.CALL_SMS_TEXT || 'Please open this link to call me live: {{CALL_URL}}';
const VISITOR_TRACKING_ENABLED = String(process.env.VISITOR_TRACKING_ENABLED || 'true') === 'true';
const VISITOR_IP_LOOKUP_ENABLED = String(process.env.VISITOR_IP_LOOKUP_ENABLED || 'true') === 'true';
const VISITOR_IP_LOOKUP_PROVIDER = process.env.VISITOR_IP_LOOKUP_PROVIDER || 'ipapi';
const CHAT_ENABLED = String(process.env.CHAT_ENABLED || 'true') === 'true';
const CHAT_MAX_UPLOAD_MB = Number(process.env.CHAT_MAX_UPLOAD_MB || '50');
const UPLOAD_STORAGE = (process.env.UPLOAD_STORAGE || 'local').toLowerCase();
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || '';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || '';
const CLOUDINARY_FOLDER = (process.env.CLOUDINARY_FOLDER || 'portfolio').replace(/^\/+|\/+$/g, '');
const USE_CLOUDINARY = UPLOAD_STORAGE === 'cloudinary' && CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET;

function normalizeAdminPath(value) {
  const fallback = '/secure-admin-dashboard';
  const raw = String(value || fallback).trim();
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const cleaned = withSlash.replace(/\/+/g, '/').replace(/\/$/, '');
  return cleaned || fallback;
}

const ADMIN_DASHBOARD_PATH = normalizeAdminPath(process.env.ADMIN_DASHBOARD_PATH || process.env.VITE_ADMIN_PATH || '/secure-admin-dashboard');

function injectRuntimeConfig(html) {
  const config = { adminPath: ADMIN_DASHBOARD_PATH };
  const script = `<script>window.__APP_CONFIG__=${JSON.stringify(config)};</script>`;
  return html.includes('</head>') ? html.replace('</head>', `${script}</head>`) : `${script}${html}`;
}

function sendFrontendIndex(res) {
  const indexFile = path.join(distDir, 'index.html');
  if (!fs.existsSync(indexFile)) return res.status(404).json({ message: 'Frontend build not found. Run npm run build first.' });
  return res.type('html').send(injectRuntimeConfig(fs.readFileSync(indexFile, 'utf8')));
}


app.use(cors({ origin: CLIENT_URL === '*' ? true : CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use('/uploads', express.static(uploadsDir));

const commonOptions = {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
  toJSON: { virtuals: true, versionKey: false, transform: (_doc, ret) => normalizeDoc(ret) },
  toObject: { virtuals: true, versionKey: false, transform: (_doc, ret) => normalizeDoc(ret) },
};

function normalizeDoc(ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

const AboutInfo = mongoose.model('AboutInfo', new mongoose.Schema({
  name: { type: String, default: 'Fahimul Arefin' },
  title: { type: String, default: 'Full Stack Software Engineer' },
  bio: { type: String, default: '' },
  tagline: { type: String, default: '' },
  years_experience: { type: Number, default: 5 },
  projects_completed: { type: Number, default: 50 },
  resume_url: { type: String, default: '' },
  profile_image_url: { type: String, default: '' },
  logo_url: { type: String, default: '' },
  hero_background_url: { type: String, default: '' },
  hero_status_text: { type: String, default: 'Available for new opportunities' },
  hero_cta_primary_text: { type: String, default: 'View My Work' },
  hero_cta_secondary_text: { type: String, default: 'Get In Touch' },
  hero_greeting: { type: String, default: "Hi, I'm" },
}, commonOptions), 'about_info');


const HeroMedia = mongoose.model('HeroMedia', new mongoose.Schema({
  title: { type: String, default: '' },
  media_url: { type: String, required: true },
  media_type: { type: String, enum: ['image', 'video'], required: true },
  display_order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
}, commonOptions), 'hero_media');

const Skill = mongoose.model('Skill', new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, enum: ['frontend', 'backend', 'database', 'mobile'], required: true },
  level: { type: Number, default: 80, min: 0, max: 100 },
  display_order: { type: Number, default: 0 },
}, commonOptions), 'skills');

const Project = mongoose.model('Project', new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  detailed_description: { type: String, default: '' },
  tech: { type: [String], default: [] },
  image_url: { type: String, default: '' },
  gallery_urls: { type: [String], default: [] },
  live_url: { type: String, default: '' },
  github_url: { type: String, default: '' },
  github_url_public: { type: Boolean, default: true },
  category: { type: String, enum: ['fullstack', 'frontend', 'backend', 'mobile'], required: true },
  display_order: { type: Number, default: 0 },
  is_featured: { type: Boolean, default: true },
}, commonOptions), 'projects');

const Experience = mongoose.model('Experience', new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  period: { type: String, required: true },
  description: { type: String, required: true },
  display_order: { type: Number, default: 0 },
}, commonOptions), 'experience');

const Education = mongoose.model('Education', new mongoose.Schema({
  degree: { type: String, required: true },
  institution: { type: String, required: true },
  period: { type: String, required: true },
  location: { type: String, default: '' },
  result: { type: String, default: '' },
  description: { type: String, default: '' },
  display_order: { type: Number, default: 0 },
}, commonOptions), 'education');

const ContactInfo = mongoose.model('ContactInfo', new mongoose.Schema({
  email: { type: String, default: 'fahimul.arefin@email.com' },
  phone: { type: String, default: '' },
  location: { type: String, default: '' },
  github_url: { type: String, default: '' },
  linkedin_url: { type: String, default: '' },
}, commonOptions), 'contact_info');


const DeliveryBasePoint = mongoose.model('DeliveryBasePoint', new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  address: { type: String, default: '', trim: true },
  plus_code: { type: String, default: '', trim: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  contact_person: { type: String, default: '', trim: true },
  phone: { type: String, default: '', trim: true },
  notes: { type: String, default: '' },
  display_order: { type: Number, default: 0 },
  is_active: { type: Boolean, default: true },
}, commonOptions), 'delivery_base_points');

const Message = mongoose.model('Message', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  message: { type: String, required: true },
  is_read: { type: Boolean, default: false },
}, commonOptions), 'messages');

const ProjectComment = mongoose.model('ProjectComment', new mongoose.Schema({
  project_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  project_title: { type: String, default: '' },
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
  comment: { type: String, required: true, trim: true, maxlength: 1500 },
  is_approved: { type: Boolean, default: true, index: true },
  ip_address: { type: String, default: '' },
  user_agent: { type: String, default: '' },
}, commonOptions), 'project_comments');

const Certificate = mongoose.model('Certificate', new mongoose.Schema({
  title: { type: String, required: true },
  issuer: { type: String, required: true },
  issue_date: { type: String, required: true },
  credential_id: { type: String, default: '' },
  credential_url: { type: String, default: '' },
  image_url: { type: String, default: '' },
  description: { type: String, default: '' },
  display_order: { type: Number, default: 0 },
}, commonOptions), 'certificates');

const VisitorSession = mongoose.model('VisitorSession', new mongoose.Schema({
  visitor_id: { type: String, required: true, unique: true, index: true },
  first_seen: { type: Date, default: Date.now },
  last_seen: { type: Date, default: Date.now, index: true },
  visits: { type: Number, default: 1 },
  last_path: { type: String, default: '' },
  referrer: { type: String, default: '' },
  phone_from_link: { type: String, default: '' },
  ip_address: { type: String, default: '' },
  user_agent: { type: String, default: '' },
  device: {
    type: { type: String, default: 'Unknown' },
    vendor: { type: String, default: '' },
    model: { type: String, default: '' },
    browser: { type: String, default: 'Unknown' },
    os: { type: String, default: 'Unknown' },
    is_mobile: { type: Boolean, default: false },
    screen: { type: String, default: '' },
    language: { type: String, default: '' },
    timezone: { type: String, default: '' },
    platform: { type: String, default: '' },
  },
  gps_location: {
    allowed: { type: Boolean, default: false },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    accuracy_meters: { type: Number, default: null },
    captured_at: { type: Date, default: null },
  },
  ip_location: {
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: '' },
    country_code: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    isp: { type: String, default: '' },
    provider: { type: String, default: '' },
    lookup_at: { type: Date, default: null },
  },
}, commonOptions), 'visitor_sessions');

const ChatSession = mongoose.model('ChatSession', new mongoose.Schema({
  visitor_id: { type: String, default: '', index: true },
  visitor_name: { type: String, default: 'Website visitor' },
  visitor_email: { type: String, default: '' },
  visitor_phone: { type: String, default: '' },
  status: { type: String, enum: ['open', 'closed'], default: 'open', index: true },
  last_message: { type: String, default: '' },
  last_message_at: { type: Date, default: Date.now, index: true },
  unread_admin_count: { type: Number, default: 0 },
  unread_visitor_count: { type: Number, default: 0 },
  ip_address: { type: String, default: '' },
  user_agent: { type: String, default: '' },
}, commonOptions), 'chat_sessions');

const ChatMessage = mongoose.model('ChatMessage', new mongoose.Schema({
  session_id: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatSession', required: true, index: true },
  sender: { type: String, enum: ['visitor', 'admin'], required: true },
  message_type: { type: String, enum: ['text', 'file', 'image', 'video'], default: 'text' },
  text: { type: String, default: '' },
  file_url: { type: String, default: '' },
  file_name: { type: String, default: '' },
  file_size: { type: Number, default: 0 },
  mime_type: { type: String, default: '' },
}, commonOptions), 'chat_messages');

const CallHistory = mongoose.model('CallHistory', new mongoose.Schema({
  call_id: { type: String, required: true, unique: true, index: true },
  customer_name: { type: String, default: 'Website visitor' },
  customer_email: { type: String, default: '' },
  customer_phone: { type: String, default: '' },
  status: { type: String, enum: ['ringing', 'accepted', 'rejected', 'cancelled', 'ended', 'missed', 'disconnected'], default: 'ringing', index: true },
  ip_address: { type: String, default: '', index: true },
  user_agent: { type: String, default: '' },
  device: {
    type: { type: String, default: 'Unknown' },
    vendor: { type: String, default: '' },
    model: { type: String, default: '' },
    browser: { type: String, default: 'Unknown' },
    os: { type: String, default: 'Unknown' },
    is_mobile: { type: Boolean, default: false },
  },
  ip_location: {
    city: { type: String, default: '' },
    region: { type: String, default: '' },
    country: { type: String, default: '' },
    country_code: { type: String, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    isp: { type: String, default: '' },
    provider: { type: String, default: '' },
    lookup_at: { type: Date, default: null },
  },
  started_at: { type: Date, default: Date.now, index: true },
  accepted_at: { type: Date, default: null },
  ended_at: { type: Date, default: null },
  duration_seconds: { type: Number, default: 0 },
  end_reason: { type: String, default: '' },
  admin_email: { type: String, default: '' },
}, commonOptions), 'call_history');

const modelMap = {
  about_info: AboutInfo,
  hero_media: HeroMedia,
  skills: Skill,
  projects: Project,
  experience: Experience,
  education: Education,
  contact_info: ContactInfo,
  delivery_base_points: DeliveryBasePoint,
  messages: Message,
  project_comments: ProjectComment,
  certificates: Certificate,
};

const singleTables = new Set(['about_info', 'contact_info']);

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

function maybeProtectWrite(req, res, next) {
  if (req.method === 'GET') {
    if (req.params.collection === 'messages' || req.params.collection === 'project_comments' || req.params.collection === 'delivery_base_points') return requireAuth(req, res, next);
    return next();
  }

  if (req.method === 'POST' && req.params.collection === 'messages') return next();
  return requireAuth(req, res, next);
}

function getModel(req, res, next) {
  const model = modelMap[req.params.collection];
  if (!model) return res.status(404).json({ message: 'Unknown collection.' });
  req.Model = model;
  next();
}

async function seedDatabase() {
  if ((await AboutInfo.countDocuments()) === 0) {
    await AboutInfo.create({
      name: 'Fahimul Arefin',
      title: 'Full Stack Software Engineer',
      bio: "I'm a full-stack software engineer with expertise in building modern web applications, mobile apps, and scalable backend systems. With a strong foundation in both frontend and backend technologies, I create seamless digital experiences that users love.",
      tagline: 'Passionate about building digital experiences',
      years_experience: 5,
      projects_completed: 50,
      profile_image_url: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=800',
      hero_status_text: 'Available for new opportunities',
      hero_cta_primary_text: 'View My Work',
      hero_cta_secondary_text: 'Get In Touch',
      hero_greeting: "Hi, I'm",
    });
  }


  if ((await HeroMedia.countDocuments()) === 0) {
    await HeroMedia.create({
      title: 'Default hero image',
      media_url: 'https://images.pexels.com/photos/3184465/pexels-photo-3184465.jpeg?auto=compress&cs=tinysrgb&w=1600',
      media_type: 'image',
      display_order: 1,
      is_active: true,
    });
  }

  if ((await ContactInfo.countDocuments()) === 0) {
    await ContactInfo.create({
      email: 'fahimul.arefin@email.com',
      phone: '+1 (555) 123-4567',
      location: 'Available Remote Worldwide',
      github_url: '#',
      linkedin_url: '#',
    });
  }

  if ((await Skill.countDocuments()) === 0) {
    await Skill.insertMany([
      ['Java', 'backend', 95, 1], ['Python', 'backend', 90, 2], ['JavaScript', 'frontend', 95, 3],
      ['TypeScript', 'frontend', 90, 4], ['React.js', 'frontend', 95, 5], ['React Native', 'mobile', 90, 6],
      ['Node.js', 'backend', 92, 7], ['Express.js', 'backend', 90, 8], ['MongoDB', 'database', 88, 9],
      ['PostgreSQL', 'database', 85, 10], ['HTML5', 'frontend', 98, 11], ['CSS3', 'frontend', 95, 12],
      ['Bootstrap', 'frontend', 92, 13],
    ].map(([name, category, level, display_order]) => ({ name, category, level, display_order })));
  }

  if ((await Project.countDocuments()) === 0) {
    await Project.insertMany([
      {
        title: 'E-Commerce Platform', description: 'Full-stack e-commerce solution with React, Node.js, and MongoDB. Features include real-time inventory, payment integration, and admin dashboard.',
        tech: ['React', 'Node.js', 'MongoDB', 'Stripe', 'Express'], image_url: 'https://images.pexels.com/photos/230544/pexels-photo-230544.jpeg?auto=compress&cs=tinysrgb&w=800', live_url: '#', github_url: '#', github_url_public: true, category: 'fullstack', display_order: 1,
      },
      {
        title: 'Task Management App', description: 'Cross-platform task management application built with React Native. Includes offline support, push notifications, and team collaboration.',
        tech: ['React Native', 'TypeScript', 'PostgreSQL', 'Node.js'], image_url: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=800', live_url: '#', github_url: '#', github_url_public: true, category: 'mobile', display_order: 2,
      },
      {
        title: 'Real-Time Chat Application', description: 'Scalable chat application with WebSocket integration, supporting private messaging, group chats, and file sharing.',
        tech: ['React', 'Socket.io', 'Node.js', 'MongoDB'], image_url: 'https://images.pexels.com/photos/267350/pexels-photo-267350.jpeg?auto=compress&cs=tinysrgb&w=800', live_url: '#', github_url: '#', github_url_public: true, category: 'fullstack', display_order: 3,
      },
      {
        title: 'API Gateway Service', description: 'High-performance API gateway with rate limiting, authentication, and request routing for microservices architecture.',
        tech: ['Java', 'Spring Boot', 'PostgreSQL', 'Redis'], image_url: 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800', live_url: '#', github_url: '#', github_url_public: true, category: 'backend', display_order: 4,
      },
    ]);
  }

  if ((await Experience.countDocuments()) === 0) {
    await Experience.insertMany([
      { title: 'Senior Full Stack Developer', company: 'TechCorp Solutions', period: '2022 - Present', description: 'Leading development of enterprise web applications. Architected microservices infrastructure serving 1M+ users. Mentoring junior developers and conducting code reviews.', display_order: 1 },
      { title: 'Full Stack Developer', company: 'Digital Innovations Inc.', period: '2020 - 2022', description: 'Developed and maintained multiple client projects using React, Node.js, and MongoDB. Implemented CI/CD pipelines and improved deployment efficiency by 40%.', display_order: 2 },
      { title: 'Junior Software Engineer', company: 'StartUp Hub', period: '2019 - 2020', description: 'Built RESTful APIs and frontend interfaces. Collaborated with cross-functional teams to deliver features on tight deadlines.', display_order: 3 },
    ]);
  }

  if ((await Education.countDocuments()) === 0) {
    await Education.insertMany([
      { degree: 'B.Sc. in Computer Science & Engineering', institution: 'Your University Name', period: '2018 - 2022', location: 'Dhaka, Bangladesh', result: 'CGPA: 3.80/4.00', description: 'Focused on software engineering, database systems, web development, algorithms, and full-stack application development.', display_order: 1 },
      { degree: 'Higher Secondary Certificate', institution: 'Your College Name', period: '2016 - 2018', location: 'Dhaka, Bangladesh', result: 'GPA: 5.00/5.00', description: 'Science group with emphasis on mathematics, physics, and information technology.', display_order: 2 },
    ]);
  }

  if ((await DeliveryBasePoint.countDocuments()) === 0) {
    await DeliveryBasePoint.insertMany([
      {
        name: 'Main Delivery Base',
        address: 'Dhaka, Bangladesh',
        plus_code: '',
        latitude: 23.8103,
        longitude: 90.4125,
        contact_person: '',
        phone: '',
        notes: 'Default delivery base point. Edit this from the secured admin dashboard.',
        display_order: 1,
        is_active: true,
      },
    ]);
  }

  if ((await Certificate.countDocuments()) === 0) {
    await Certificate.insertMany([
      { title: 'AWS Certified Solutions Architect', issuer: 'Amazon Web Services', issue_date: '2023', credential_id: 'AWS-SAA-C03', credential_url: 'https://aws.amazon.com/certification/', image_url: 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800', description: 'Professional certification for designing distributed systems on AWS', display_order: 1 },
      { title: 'Meta Front-End Developer Professional Certificate', issuer: 'Meta', issue_date: '2023', credential_id: 'META-FE-2023', credential_url: 'https://www.coursera.org/professional-certificates/meta-front-end-developer', image_url: 'https://images.pexels.com/photos/270348/pexels-photo-270348.jpeg?auto=compress&cs=tinysrgb&w=800', description: 'Comprehensive front-end development certification covering React, JavaScript, and modern web development', display_order: 2 },
      { title: 'Google Cloud Professional Developer', issuer: 'Google Cloud', issue_date: '2022', credential_id: 'GCP-PD-2022', credential_url: 'https://cloud.google.com/certification/', image_url: 'https://images.pexels.com/photos/1181671/pexels-photo-1181671.jpeg?auto=compress&cs=tinysrgb&w=800', description: 'Certification for building scalable applications on Google Cloud Platform', display_order: 3 },
    ]);
  }
}

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required.' });

  const passwordOk = process.env.ADMIN_PASSWORD_HASH
    ? await bcrypt.compare(password, process.env.ADMIN_PASSWORD_HASH)
    : password === ADMIN_PASSWORD;

  if (email !== ADMIN_EMAIL || !passwordOk) {
    return res.status(401).json({ message: 'Invalid admin email or password.' });
  }

  const user = { email: ADMIN_EMAIL, role: 'admin' };
  const token = jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

function buildIceServers() {
  if (ICE_SERVERS_JSON) {
    try {
      const parsed = JSON.parse(ICE_SERVERS_JSON);
      if (Array.isArray(parsed)) return parsed;
    } catch (error) {
      console.warn('Invalid ICE_SERVERS_JSON. Falling back to STUN_URLS/TURN_URLS.', error.message);
    }
  }

  const iceServers = [];
  const stunUrls = STUN_URLS.split(',').map((url) => url.trim()).filter(Boolean);
  if (stunUrls.length) iceServers.push({ urls: stunUrls });

  const turnUrls = TURN_URLS.split(',').map((url) => url.trim()).filter(Boolean);
  if (turnUrls.length) {
    iceServers.push({ urls: turnUrls, username: TURN_USERNAME, credential: TURN_CREDENTIAL });
  }

  return iceServers;
}

function buildRingConfig() {
  return {
    enabled: CALL_RING_ENABLED,
    volume: Number.isFinite(CALL_RING_VOLUME) ? Math.max(0, Math.min(1, CALL_RING_VOLUME)) : 1,
    frequency: Number.isFinite(CALL_RING_FREQUENCY) ? CALL_RING_FREQUENCY : 950,
    intervalMs: Number.isFinite(CALL_RING_INTERVAL_MS) ? Math.max(300, CALL_RING_INTERVAL_MS) : 1200,
    beepMs: Number.isFinite(CALL_RING_BEEP_MS) ? Math.max(100, CALL_RING_BEEP_MS) : 700,
    vibrationEnabled: CALL_VIBRATION_ENABLED,
  };
}


function getPublicBaseUrl(req) {
  if (PUBLIC_APP_URL) return PUBLIC_APP_URL;
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`.replace(/\/$/, '');
}

function normalizeBangladeshPhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';

  const cleaned = raw.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+880')) return `880${cleaned.slice(4)}`;
  if (cleaned.startsWith('880')) return cleaned;
  if (cleaned.startsWith('01') && cleaned.length === 11) return `88${cleaned}`;
  if (cleaned.startsWith('1') && cleaned.length === 10) return `880${cleaned}`;
  return cleaned.replace(/^\+/, '');
}

function buildCallUrl(req, phone = '') {
  const base = getPublicBaseUrl(req);
  const url = new URL('/call', base);
  const normalizedPhone = normalizeBangladeshPhone(phone);
  if (normalizedPhone) url.searchParams.set('phone', normalizedPhone);
  return url.toString();
}

function parseBulkSmsBdResponse(responseText) {
  const raw = String(responseText || '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  const textForCode = parsed && typeof parsed === 'object'
    ? String(parsed.response_code || parsed.code || parsed.status || parsed.status_code || parsed.message || parsed.error || raw)
    : raw;
  const codeMatch = textForCode.match(/\b(\d{3,4})\b/);
  const code = codeMatch ? codeMatch[1] : '';

  const lower = raw.toLowerCase();
  const success = code === '202'
    || lower.includes('sms submitted')
    || lower.includes('submitted successfully')
    || lower.includes('successfully submitted')
    || lower.includes('success');

  const errorMessages = {
    1002: 'Sender ID is incorrect, disabled, or not approved in BulkSMSBD.',
    1003: 'BulkSMSBD says required fields are missing. Check api_key, type, number, senderid, and message.',
    1004: 'BulkSMSBD API key is invalid.',
    1005: 'Insufficient SMS balance in BulkSMSBD account.',
    1006: 'BulkSMSBD says the phone number is invalid.',
  };

  const failedByText = lower.includes('error')
    || lower.includes('invalid')
    || lower.includes('failed')
    || lower.includes('not correct')
    || lower.includes('disabled')
    || lower.includes('required')
    || lower.includes('insufficient')
    || lower.includes('balance');

  return {
    ok: success && !failedByText,
    code,
    raw,
    parsed,
    gatewayMessage: errorMessages[code] || raw || 'No response body from BulkSMSBD.',
  };
}

async function sendBulkSmsBd({ number, message }) {
  if (!BULKSMSBD_API_KEY) {
    throw new Error('BULKSMSBD_API_KEY is missing in environment variables.');
  }
  if (!BULKSMSBD_SENDER_ID) {
    throw new Error('BULKSMSBD_SENDER_ID is missing in environment variables.');
  }

  const normalizedNumber = normalizeBangladeshPhone(number);
  if (!/^8801[3-9]\d{8}$/.test(normalizedNumber)) {
    throw new Error(`Invalid Bangladesh mobile number after formatting: ${normalizedNumber}. Use 01XXXXXXXXX or 8801XXXXXXXXX.`);
  }

  const params = new URLSearchParams();
  params.set('api_key', BULKSMSBD_API_KEY);
  params.set('type', BULKSMSBD_TYPE);
  params.set('number', normalizedNumber);
  params.set('senderid', BULKSMSBD_SENDER_ID);
  params.set('message', message);

  const response = await fetch(BULKSMSBD_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const responseText = await response.text();
  const gateway = parseBulkSmsBdResponse(responseText);

  if (!response.ok) {
    throw new Error(`BulkSMSBD HTTP ${response.status}: ${gateway.raw.slice(0, 300)}`);
  }

  if (!gateway.ok) {
    throw new Error(`BulkSMSBD did not accept the SMS. ${gateway.gatewayMessage}`);
  }

  return {
    number: normalizedNumber,
    providerResponse: gateway.raw,
    providerCode: gateway.code || null,
    providerMessage: gateway.gatewayMessage,
  };
}



function getClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = forwarded || req.socket?.remoteAddress || req.ip || '';
  return raw.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

function getSocketIp(socket) {
  const headers = socket.handshake?.headers || {};
  const forwarded = String(headers['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = forwarded || socket.request?.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '').replace(/^::1$/, '127.0.0.1');
}

function normalizeCallHistory(doc) {
  if (!doc) return null;
  return typeof doc.toJSON === 'function' ? doc.toJSON() : doc;
}

async function markCallHistory(call, status, reason = '', adminSocket = null) {
  if (!call?.callId) return null;
  const now = new Date();
  const startedAt = call.startedAtDate || (call.createdAt ? new Date(call.createdAt) : now);
  const acceptedAt = call.acceptedAt ? new Date(call.acceptedAt) : null;
  const durationBase = acceptedAt || startedAt;
  const durationSeconds = Math.max(0, Math.round((now.getTime() - durationBase.getTime()) / 1000));
  return CallHistory.findOneAndUpdate(
    { call_id: call.callId },
    {
      $set: {
        status,
        ended_at: now,
        duration_seconds: durationSeconds,
        end_reason: reason,
        ...(adminSocket?.user?.email ? { admin_email: adminSocket.user.email } : {}),
      },
    },
    { new: true }
  ).exec();
}

function parseUserAgent(userAgent = '') {
  const ua = String(userAgent || '');
  const lower = ua.toLowerCase();
  const isMobile = /mobile|android|iphone|ipod|windows phone/i.test(ua);
  const isTablet = /ipad|tablet/i.test(ua) || (lower.includes('android') && !lower.includes('mobile'));
  const os = /windows/i.test(ua) ? 'Windows'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad|ipod/i.test(ua) ? 'iOS/iPadOS'
    : /mac os x|macintosh/i.test(ua) ? 'macOS'
    : /linux/i.test(ua) ? 'Linux'
    : 'Unknown';
  const browser = /edg\//i.test(ua) ? 'Microsoft Edge'
    : /opr\//i.test(ua) || /opera/i.test(ua) ? 'Opera'
    : /chrome|crios/i.test(ua) && !/edg\//i.test(ua) ? 'Chrome'
    : /firefox|fxios/i.test(ua) ? 'Firefox'
    : /safari/i.test(ua) && !/chrome|crios|android/i.test(ua) ? 'Safari'
    : 'Unknown';

  let vendor = '';
  let model = '';
  if (/iphone/i.test(ua)) { vendor = 'Apple'; model = 'iPhone'; }
  else if (/ipad/i.test(ua)) { vendor = 'Apple'; model = 'iPad'; }
  else if (/samsung|sm-/i.test(ua)) { vendor = 'Samsung'; model = (ua.match(/SM-[A-Z0-9]+/i) || ['Samsung Android'])[0]; }
  else if (/pixel/i.test(ua)) { vendor = 'Google'; model = (ua.match(/Pixel [A-Za-z0-9 ]+/i) || ['Google Pixel'])[0].trim(); }
  else if (/redmi|xiaomi|mi\s/i.test(ua)) { vendor = 'Xiaomi'; model = 'Xiaomi/Redmi Android'; }
  else if (/huawei/i.test(ua)) { vendor = 'Huawei'; model = 'Huawei Android'; }
  else if (/android/i.test(ua)) { vendor = 'Android'; model = 'Android phone/tablet'; }

  return {
    type: isTablet ? 'Tablet' : isMobile ? 'Phone' : 'Desktop/Laptop',
    vendor,
    model,
    browser,
    os,
    is_mobile: isMobile || isTablet,
  };
}

async function lookupIpLocation(ip) {
  if (!VISITOR_IP_LOOKUP_ENABLED || !ip || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('172.16.')) {
    return null;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    const url = VISITOR_IP_LOOKUP_PROVIDER === 'ipapi'
      ? `https://ipapi.co/${encodeURIComponent(ip)}/json/`
      : `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,lat,lon,isp,query`;
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = await response.json();

    if (VISITOR_IP_LOOKUP_PROVIDER === 'ipapi') {
      if (data.error) return null;
      return {
        city: data.city || '',
        region: data.region || '',
        country: data.country_name || '',
        country_code: data.country_code || '',
        lat: typeof data.latitude === 'number' ? data.latitude : null,
        lng: typeof data.longitude === 'number' ? data.longitude : null,
        isp: data.org || data.asn || '',
        provider: 'ipapi.co',
        lookup_at: new Date(),
      };
    }

    if (data.status !== 'success') return null;
    return {
      city: data.city || '',
      region: data.regionName || '',
      country: data.country || '',
      country_code: data.countryCode || '',
      lat: typeof data.lat === 'number' ? data.lat : null,
      lng: typeof data.lon === 'number' ? data.lon : null,
      isp: data.isp || '',
      provider: 'ip-api.com',
      lookup_at: new Date(),
    };
  } catch {
    return null;
  }
}


function isValidEmail(email = '') {
  const value = String(email || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 160;
}

function sanitizePublicText(value = '', maxLength = 1500) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function publicProjectComment(doc) {
  const item = typeof doc?.toJSON === 'function' ? doc.toJSON() : doc;
  if (!item) return null;
  return {
    id: item.id,
    project_id: item.project_id,
    project_title: item.project_title,
    name: item.name,
    comment: item.comment,
    is_approved: item.is_approved,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}


app.get('/api/projects/:projectId/comments', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    const project = await Project.findById(req.params.projectId).select('_id').lean().exec();
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const limit = Math.min(Number(req.query.limit || 100), 300);
    const docs = await ProjectComment.find({ project_id: req.params.projectId, is_approved: true })
      .sort({ created_at: -1 })
      .limit(limit)
      .exec();
    res.json(docs.map(publicProjectComment));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Could not load project comments.' });
  }
});

app.post('/api/projects/:projectId/comments', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.projectId)) {
      return res.status(400).json({ message: 'Invalid project ID.' });
    }

    const project = await Project.findById(req.params.projectId).select('title').exec();
    if (!project) return res.status(404).json({ message: 'Project not found.' });

    const name = sanitizePublicText(req.body?.name, 80);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const comment = sanitizePublicText(req.body?.comment, 1500);

    if (!name || name.length < 2) {
      return res.status(400).json({ message: 'Please enter your name.' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address.' });
    }
    if (!comment || comment.length < 3) {
      return res.status(400).json({ message: 'Please write a comment.' });
    }

    const doc = await ProjectComment.create({
      project_id: project.id,
      project_title: project.title,
      name,
      email,
      comment,
      is_approved: true,
      ip_address: getClientIp(req),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
    });

    res.status(201).json(publicProjectComment(doc));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Could not submit project comment.' });
  }
});

app.get('/api/project-comments', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 200), 500);
  const docs = await ProjectComment.find().sort({ created_at: -1 }).limit(limit).exec();
  res.json(docs);
});

app.patch('/api/project-comments/:id', requireAuth, async (req, res) => {
  const updates = {};
  if (typeof req.body?.is_approved === 'boolean') updates.is_approved = req.body.is_approved;
  const doc = await ProjectComment.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ message: 'Project comment not found.' });
  res.json(doc);
});

app.delete('/api/project-comments/:id', requireAuth, async (req, res) => {
  const doc = await ProjectComment.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Project comment not found.' });
  res.json({ success: true });
});

app.post('/api/visitor/track', async (req, res) => {
  try {
    if (!VISITOR_TRACKING_ENABLED) return res.json({ ok: true, tracking: false });

    const visitorId = String(req.body?.visitorId || '').slice(0, 120);
    if (!visitorId) return res.status(400).json({ message: 'visitorId is required.' });

    const ip = getClientIp(req);
    const ua = String(req.headers['user-agent'] || req.body?.userAgent || '').slice(0, 1200);
    const parsedDevice = parseUserAgent(ua);
    const now = new Date();
    const existing = await VisitorSession.findOne({ visitor_id: visitorId });
    const bodyDevice = req.body?.device || {};
    const gps = req.body?.gps || req.body?.cachedGps || null;
    const phoneFromLink = normalizeBangladeshPhone(req.body?.phoneFromLink || '');

    let ipLocation = existing?.ip_location || undefined;
    const shouldLookupIp = !existing?.ip_location?.lookup_at || existing.ip_address !== ip;
    if (shouldLookupIp) {
      const lookedUp = await lookupIpLocation(ip);
      if (lookedUp) ipLocation = lookedUp;
    }

    const update = {
      $set: {
        last_seen: now,
        last_path: String(req.body?.path || '').slice(0, 300),
        referrer: String(req.body?.referrer || '').slice(0, 500),
        ip_address: ip,
        user_agent: ua,
        phone_from_link: phoneFromLink || existing?.phone_from_link || '',
        device: {
          ...parsedDevice,
          screen: String(bodyDevice.screen || '').slice(0, 80),
          language: String(bodyDevice.language || '').slice(0, 80),
          timezone: String(bodyDevice.timezone || '').slice(0, 120),
          platform: String(bodyDevice.platform || '').slice(0, 120),
        },
        ...(ipLocation ? { ip_location: ipLocation } : {}),
      },
      $setOnInsert: { first_seen: now },
      $inc: { visits: 1 },
    };

    if (gps && typeof gps.lat === 'number' && typeof gps.lng === 'number') {
      update.$set.gps_location = {
        allowed: true,
        lat: gps.lat,
        lng: gps.lng,
        accuracy_meters: typeof gps.accuracy === 'number' ? gps.accuracy : null,
        captured_at: now,
      };
    }

    const doc = await VisitorSession.findOneAndUpdate({ visitor_id: visitorId }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.json({ ok: true, visitor: { id: doc.id, visitor_id: doc.visitor_id } });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Could not track visitor.' });
  }
});

app.get('/api/visitors', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 300);
  const docs = await VisitorSession.find().sort({ last_seen: -1 }).limit(limit).exec();
  res.json(docs);
});

app.get('/api/visitors/:id', requireAuth, async (req, res) => {
  const doc = await VisitorSession.findById(req.params.id).exec();
  if (!doc) return res.status(404).json({ message: 'Visitor not found.' });
  res.json(doc);
});

app.delete('/api/visitors/:id', requireAuth, async (req, res) => {
  const doc = await VisitorSession.findByIdAndDelete(req.params.id).exec();
  if (!doc) return res.status(404).json({ message: 'Visitor not found.' });
  res.json({ success: true });
});

app.get('/api/sms/debug', requireAuth, (_req, res) => {
  res.json({
    configured: Boolean(BULKSMSBD_API_KEY && BULKSMSBD_SENDER_ID),
    endpoint: BULKSMSBD_ENDPOINT,
    senderId: BULKSMSBD_SENDER_ID ? `${BULKSMSBD_SENDER_ID.slice(0, 3)}***` : '',
    type: BULKSMSBD_TYPE,
  });
});

app.get('/api/call/url', requireAuth, (req, res) => {
  res.json({ callUrl: buildCallUrl(req, String(req.query.phone || '')) });
});

app.post('/api/call/send-sms', requireAuth, async (req, res) => {
  try {
    const number = normalizeBangladeshPhone(req.body?.phone);
    if (!number || number.length < 10) {
      return res.status(400).json({ message: 'Valid phone number is required.' });
    }

    const callUrl = buildCallUrl(req, number);
    const customMessage = String(req.body?.message || '').trim();
    const message = (customMessage || CALL_SMS_TEXT).replace(/{{CALL_URL}}/g, callUrl);

    if (!message.includes(callUrl)) {
      return res.status(400).json({ message: 'SMS message must include {{CALL_URL}} or the generated call URL.' });
    }

    const smsResult = await sendBulkSmsBd({ number, message });
    res.json({ ok: true, number: smsResult.number, callUrl, message, ...smsResult });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Could not send SMS.' });
  }
});


app.post('/api/sms/send', requireAuth, async (req, res) => {
  try {
    const number = normalizeBangladeshPhone(req.body?.phone);
    if (!number || number.length < 10) {
      return res.status(400).json({ message: 'Valid phone number is required.' });
    }

    const includeCallUrl = Boolean(req.body?.includeCallUrl);
    const callUrl = includeCallUrl ? buildCallUrl(req, number) : '';
    let message = String(req.body?.message || '').trim();

    if (!message) {
      return res.status(400).json({ message: 'SMS message is required.' });
    }

    if (includeCallUrl) {
      if (message.includes('{{CALL_URL}}')) {
        message = message.replace(/{{CALL_URL}}/g, callUrl);
      } else if (!message.includes(callUrl)) {
        message = `${message}\n${callUrl}`;
      }
    } else {
      message = message.replace(/{{CALL_URL}}/g, '').trim();
    }

    if (message.length > 918) {
      return res.status(400).json({ message: 'SMS message is too long. Keep it within 918 characters.' });
    }

    const smsResult = await sendBulkSmsBd({ number, message });
    res.json({ ok: true, number: smsResult.number, callUrl: callUrl || null, message, ...smsResult });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Could not send SMS.' });
  }
});

app.get('/api/call/history', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const status = String(req.query.status || '').trim();
  const filter = status ? { status } : {};
  const docs = await CallHistory.find(filter).sort({ started_at: -1 }).limit(limit).exec();
  res.json(docs.map(normalizeCallHistory));
});

app.get('/api/call/history/:id', requireAuth, async (req, res) => {
  const doc = await CallHistory.findById(req.params.id).exec();
  if (!doc) return res.status(404).json({ message: 'Call history not found.' });
  res.json(normalizeCallHistory(doc));
});

app.delete('/api/call/history/:id', requireAuth, async (req, res) => {
  const doc = await CallHistory.findByIdAndDelete(req.params.id).exec();
  if (!doc) return res.status(404).json({ message: 'Call history not found.' });
  res.json({ success: true });
});

app.get('/api/call/config', (_req, res) => {
  res.json({
    enabled: CALL_ENABLED,
    iceServers: buildIceServers(),
    ring: buildRingConfig(),
    adminApp: {
      autoOpenIncomingPage: CALL_AUTO_OPEN_INCOMING_PAGE,
      pwaEnabled: true,
    },
  });
});


function classifyChatAttachment(file = {}) {
  const mime = String(file.mimetype || '').toLowerCase();
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  return 'file';
}

function sanitizeChatMessage(text = '') {
  return String(text || '').replace(/[\u0000]/g, '').trim().slice(0, 3000);
}

async function publicChatSession(session) {
  if (!session) return null;
  return typeof session.toJSON === 'function' ? session.toJSON() : session;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Math.max(100, CHAT_MAX_UPLOAD_MB) * 1024 * 1024 } });

function safeUploadFolder(folder = 'general') {
  return String(folder || 'general').replace(/[^a-zA-Z0-9-_]/g, '') || 'general';
}

function sanitizeFileName(name = 'file') {
  return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '-').slice(-120);
}

async function saveLocalUpload(file, folder = 'general') {
  const safeFolder = safeUploadFolder(folder);
  const ext = path.extname(file.originalname || '');
  const base = `${safeFolder}-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
  const filePath = path.join(uploadsDir, base);
  await fs.promises.writeFile(filePath, file.buffer);
  return { url: `/uploads/${base}`, provider: 'local', fileName: file.originalname, fileSize: file.size, mimeType: file.mimetype };
}

function cloudinarySignature(params) {
  const raw = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(raw + CLOUDINARY_API_SECRET).digest('hex');
}

async function uploadToCloudinary(file, folder = 'general') {
  if (!USE_CLOUDINARY) return saveLocalUpload(file, folder);

  const safeFolder = safeUploadFolder(folder);
  const timestamp = Math.floor(Date.now() / 1000);
  const uploadFolder = `${CLOUDINARY_FOLDER}/${safeFolder}`.replace(/^\/+|\/+$/g, '');
  const params = { folder: uploadFolder, timestamp };
  const signature = cloudinarySignature(params);
  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`;

  const form = new FormData();
  form.append('file', new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }), sanitizeFileName(file.originalname));
  form.append('api_key', CLOUDINARY_API_KEY);
  form.append('timestamp', String(timestamp));
  form.append('folder', uploadFolder);
  form.append('signature', signature);

  const response = await fetch(endpoint, { method: 'POST', body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || `Cloudinary upload failed with status ${response.status}`;
    throw new Error(message);
  }

  return {
    url: payload.secure_url || payload.url,
    provider: 'cloudinary',
    publicId: payload.public_id,
    resourceType: payload.resource_type,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}

function inferCloudinaryPublicId(fileUrl = '') {
  try {
    const parsed = new URL(fileUrl);
    if (!parsed.hostname.includes('cloudinary.com')) return '';
    const marker = '/upload/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return '';
    let publicPath = parsed.pathname.slice(idx + marker.length);
    publicPath = publicPath.replace(/^v\d+\//, '');
    publicPath = decodeURIComponent(publicPath);
    return publicPath.replace(/\.[a-zA-Z0-9]+$/, '');
  } catch {
    return '';
  }
}

async function deleteFromCloudinary(fileUrl = '') {
  if (!USE_CLOUDINARY) return false;
  const publicId = inferCloudinaryPublicId(fileUrl);
  if (!publicId) return false;

  const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');
  for (const resourceType of ['image', 'video', 'raw']) {
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/${resourceType}/upload/${encodeURIComponent(publicId)}`;
    const response = await fetch(endpoint, { method: 'DELETE', headers: { Authorization: `Basic ${auth}` } });
    if (response.ok) return true;
  }
  return false;
}

async function deleteStoredFile(fileUrl = '') {
  if (!fileUrl) return false;
  if (fileUrl.startsWith('/uploads/')) {
    const filePath = path.join(uploadsDir, path.basename(fileUrl));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return true;
  }
  if (fileUrl.includes('cloudinary.com')) {
    return deleteFromCloudinary(fileUrl);
  }
  return false;
}

app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
  try {
    if (!CHAT_ENABLED) return res.status(503).json({ message: 'Live chat is disabled.' });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    const allowed = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
      'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
      'application/pdf', 'text/plain',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-zip-compressed'
    ];

    if (!allowed.includes(req.file.mimetype)) {
      return res.status(400).json({ message: 'This file type is not allowed for chat.' });
    }

    const saved = await uploadToCloudinary(req.file, 'chat');
    res.json({
      url: saved.url,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      messageType: classifyChatAttachment(req.file),
      provider: saved.provider,
    });
  } catch (error) {
    res.status(500).json({ message: error.message || 'File upload failed.' });
  }
});

app.get('/api/chat/sessions', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 300);
  const docs = await ChatSession.find().sort({ last_message_at: -1 }).limit(limit).exec();
  res.json(docs);
});

app.get('/api/chat/sessions/:id/messages', requireAuth, async (req, res) => {
  const docs = await ChatMessage.find({ session_id: req.params.id }).sort({ created_at: 1 }).limit(500).exec();
  await ChatSession.findByIdAndUpdate(req.params.id, { unread_admin_count: 0 });
  res.json(docs);
});

app.patch('/api/chat/sessions/:id', requireAuth, async (req, res) => {
  const updates = {};
  if (typeof req.body?.status === 'string') updates.status = req.body.status === 'closed' ? 'closed' : 'open';
  if (req.body?.markAdminRead) updates.unread_admin_count = 0;
  const doc = await ChatSession.findByIdAndUpdate(req.params.id, updates, { new: true });
  if (!doc) return res.status(404).json({ message: 'Chat session not found.' });
  io.to(`chat:${doc.id}`).emit('chat:session-updated', await publicChatSession(doc));
  io.to('chat:admins').emit('chat:session-updated', await publicChatSession(doc));
  res.json(doc);
});

app.post('/api/upload', requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });
    const folder = req.body.folder || 'general';
    const saved = await uploadToCloudinary(req.file, folder);
    res.json(saved);
  } catch (error) {
    res.status(500).json({ message: error.message || 'File upload failed.' });
  }
});

app.delete('/api/upload', requireAuth, async (req, res) => {
  try {
    const fileUrl = String(req.body.url || '');
    const success = await deleteStoredFile(fileUrl);
    res.json({ success });
  } catch {
    res.json({ success: false });
  }
});

app.get('/api/:collection', getModel, maybeProtectWrite, async (req, res) => {
  const { collection } = req.params;
  const { order, single } = req.query;
  let query = req.Model.find();

  if (order) {
    const [field, direction] = String(order).split(':');
    query = query.sort({ [field]: direction === 'desc' ? -1 : 1 });
  }

  const docs = await query.exec();
  if (single === 'true' || singleTables.has(collection)) {
    return res.json(docs[0] || null);
  }
  res.json(docs);
});

app.post('/api/:collection', getModel, maybeProtectWrite, async (req, res) => {
  const doc = await req.Model.create(req.body);
  res.status(201).json(doc);
});

app.patch('/api/:collection/:id', getModel, maybeProtectWrite, async (req, res) => {
  const doc = await req.Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  res.json(doc);
});

app.delete('/api/:collection/:id', getModel, maybeProtectWrite, async (req, res) => {
  const doc = await req.Model.findByIdAndDelete(req.params.id);
  if (!doc) return res.status(404).json({ message: 'Document not found.' });
  res.json({ success: true });
});

app.get('/manifest.webmanifest', (_req, res) => {
  res.json({
    name: 'Portfolio Admin Secure Dashboard',
    short_name: 'Admin',
    description: 'Installable private admin dashboard for portfolio management, live calls, SMS, visitors, and chat.',
    start_url: `${ADMIN_DASHBOARD_PATH}?source=pwa`,
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'browser'],
    background_color: '#020617',
    theme_color: '#f59e0b',
    orientation: 'portrait',
    categories: ['business', 'productivity', 'communication'],
    icons: [
      { src: '/icons/admin-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/admin-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/admin-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/admin-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
});

app.use(express.static(distDir, { index: false }));
app.get('*', (_req, res) => sendFrontendIndex(res));

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: { origin: CLIENT_URL === '*' ? true : CLIENT_URL, credentials: true },
});

const admins = new Set();
const activeCalls = new Map();

function publicCall(call) {
  return {
    callId: call.callId,
    customerName: call.customerName,
    customerEmail: call.customerEmail,
    customerPhone: call.customerPhone || '',
    status: call.status,
    createdAt: call.createdAt,
    acceptedAt: call.acceptedAt || null,
    ipAddress: call.ipAddress || '',
    device: call.device || null,
    ipLocation: call.ipLocation || null,
  };
}

function broadcastAdminCalls() {
  const calls = [...activeCalls.values()].map(publicCall);
  admins.forEach((adminSocketId) => io.to(adminSocketId).emit('admin:calls', calls));
}

io.use((socket, next) => {
  const role = socket.handshake.auth?.role || 'customer';
  if (role === 'admin') {
    const token = socket.handshake.auth?.token;
    try {
      socket.user = jwt.verify(token, JWT_SECRET);
      socket.role = 'admin';
      return next();
    } catch {
      return next(new Error('Admin socket authentication failed.'));
    }
  }

  socket.role = 'customer';
  return next();
});

io.on('connection', (socket) => {
  if (socket.role === 'admin') {
    admins.add(socket.id);
    socket.join('admins');
    socket.join('chat:admins');
    socket.emit('admin:calls', [...activeCalls.values()].map(publicCall));
    ChatSession.find().sort({ last_message_at: -1 }).limit(100).then((sessions) => {
      socket.emit('chat:sessions', sessions.map((doc) => doc.toJSON()));
    }).catch(() => {});
  }

  socket.on('customer:start-call', async (payload = {}, callback) => {
    if (!CALL_ENABLED) return callback?.({ ok: false, message: 'Live calling is disabled.' });
    if (socket.role !== 'customer') return;

    try {
      const callId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const ipAddress = getSocketIp(socket);
      const userAgent = String(socket.handshake.headers?.['user-agent'] || '').slice(0, 1200);
      const device = parseUserAgent(userAgent);
      const ipLocation = await lookupIpLocation(ipAddress);
      const now = new Date();
      const customerPhone = normalizeBangladeshPhone(payload.customerPhone || payload.phone || '');

      const history = await CallHistory.create({
        call_id: callId,
        customer_name: String(payload.customerName || 'Website visitor').slice(0, 80),
        customer_email: String(payload.customerEmail || '').slice(0, 120),
        customer_phone: customerPhone,
        status: 'ringing',
        ip_address: ipAddress,
        user_agent: userAgent,
        device,
        ...(ipLocation ? { ip_location: ipLocation } : {}),
        started_at: now,
      });

      const call = {
        callId,
        historyId: history.id,
        customerSocketId: socket.id,
        adminSocketId: null,
        customerName: history.customer_name,
        customerEmail: history.customer_email,
        customerPhone,
        status: 'ringing',
        createdAt: now.toISOString(),
        startedAtDate: now,
        ipAddress,
        userAgent,
        device,
        ipLocation,
      };

      activeCalls.set(callId, call);
      socket.join(callId);
      socket.data.callId = callId;
      callback?.({ ok: true, callId, iceServers: buildIceServers() });
      io.to('admins').emit('admin:incoming-call', publicCall(call));
      io.to('admins').emit('admin:call-history-updated', normalizeCallHistory(history));
      broadcastAdminCalls();
    } catch (error) {
      callback?.({ ok: false, message: error instanceof Error ? error.message : 'Could not start call.' });
    }
  });

  socket.on('admin:accept-call', ({ callId } = {}, callback) => {
    if (socket.role !== 'admin') return;
    const call = activeCalls.get(callId);
    if (!call) return callback?.({ ok: false, message: 'Call not found or already ended.' });
    if (call.status !== 'ringing') return callback?.({ ok: false, message: 'Call is no longer ringing.' });

    call.status = 'accepted';
    call.adminSocketId = socket.id;
    call.acceptedAt = new Date().toISOString();
    CallHistory.findOneAndUpdate(
      { call_id: call.callId },
      { $set: { status: 'accepted', accepted_at: new Date(call.acceptedAt), admin_email: socket.user?.email || '' } },
      { new: true }
    ).then((history) => { if (history) io.to('admins').emit('admin:call-history-updated', normalizeCallHistory(history)); }).catch(() => {});
    socket.join(callId);
    callback?.({ ok: true, call: publicCall(call), iceServers: buildIceServers() });
    io.to(call.customerSocketId).emit('customer:call-accepted', publicCall(call));
    broadcastAdminCalls();
  });


  socket.on('visitor:chat-start', async (payload = {}, callback) => {
    if (!CHAT_ENABLED) return callback?.({ ok: false, message: 'Live chat is disabled.' });
    if (socket.role !== 'customer') return;

    try {
      const visitorId = String(payload.visitorId || socket.id).slice(0, 120);
      const sessionId = String(payload.sessionId || '').trim();
      let session = null;

      if (sessionId && mongoose.isValidObjectId(sessionId)) {
        session = await ChatSession.findById(sessionId);
      }

      if (!session) {
        session = await ChatSession.create({
          visitor_id: visitorId,
          visitor_name: String(payload.name || 'Website visitor').slice(0, 80),
          visitor_email: String(payload.email || '').slice(0, 120),
          visitor_phone: String(payload.phone || '').slice(0, 40),
          ip_address: getClientIp({ ...socket.request, headers: socket.handshake.headers }),
          user_agent: String(socket.handshake.headers?.['user-agent'] || '').slice(0, 600),
          status: 'open',
          last_message: 'Chat started',
          last_message_at: new Date(),
        });
      } else if (session.status === 'closed') {
        session.status = 'open';
        session.last_message_at = new Date();
        await session.save();
      }

      socket.join(`chat:${session.id}`);
      socket.data.chatSessionId = session.id;
      const messages = await ChatMessage.find({ session_id: session.id }).sort({ created_at: 1 }).limit(200);
      callback?.({ ok: true, session: await publicChatSession(session), messages: messages.map((doc) => doc.toJSON()) });
      io.to('chat:admins').emit('chat:session-updated', await publicChatSession(session));
    } catch (error) {
      callback?.({ ok: false, message: error instanceof Error ? error.message : 'Could not start chat.' });
    }
  });

  socket.on('chat:join-session', async ({ sessionId } = {}, callback) => {
    if (!CHAT_ENABLED) return callback?.({ ok: false, message: 'Live chat is disabled.' });
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) return callback?.({ ok: false, message: 'Invalid chat session.' });
    if (socket.role !== 'admin' && socket.data.chatSessionId !== sessionId) return callback?.({ ok: false, message: 'Not allowed for this chat session.' });

    socket.join(`chat:${sessionId}`);
    const messages = await ChatMessage.find({ session_id: sessionId }).sort({ created_at: 1 }).limit(500);
    if (socket.role === 'admin') await ChatSession.findByIdAndUpdate(sessionId, { unread_admin_count: 0 });
    if (socket.role !== 'admin') await ChatSession.findByIdAndUpdate(sessionId, { unread_visitor_count: 0 });
    callback?.({ ok: true, messages: messages.map((doc) => doc.toJSON()) });
  });

  socket.on('chat:message', async (payload = {}, callback) => {
    if (!CHAT_ENABLED) return callback?.({ ok: false, message: 'Live chat is disabled.' });

    try {
      const sessionId = String(payload.sessionId || socket.data.chatSessionId || '').trim();
      if (!sessionId || !mongoose.isValidObjectId(sessionId)) return callback?.({ ok: false, message: 'Invalid chat session.' });

      const session = await ChatSession.findById(sessionId);
      if (!session) return callback?.({ ok: false, message: 'Chat session not found.' });
      if (socket.role !== 'admin' && socket.data.chatSessionId !== sessionId) return callback?.({ ok: false, message: 'Not allowed for this chat session.' });

      const attachment = payload.attachment || null;
      const text = sanitizeChatMessage(payload.text || '');
      const messageType = attachment?.messageType || (attachment?.mimeType?.startsWith?.('image/') ? 'image' : attachment?.mimeType?.startsWith?.('video/') ? 'video' : attachment?.url ? 'file' : 'text');

      if (!text && !attachment?.url) {
        return callback?.({ ok: false, message: 'Message text or attachment is required.' });
      }

      const message = await ChatMessage.create({
        session_id: sessionId,
        sender: socket.role === 'admin' ? 'admin' : 'visitor',
        message_type: messageType,
        text,
        file_url: String(attachment?.url || ''),
        file_name: String(attachment?.fileName || ''),
        file_size: Number(attachment?.fileSize || 0),
        mime_type: String(attachment?.mimeType || ''),
      });

      session.last_message = text || (messageType === 'image' ? 'Photo sent' : messageType === 'video' ? 'Video sent' : 'File sent');
      session.last_message_at = new Date();
      session.status = 'open';
      if (socket.role === 'admin') session.unread_visitor_count += 1;
      else session.unread_admin_count += 1;
      await session.save();

      const messageJson = message.toJSON();
      const sessionJson = await publicChatSession(session);
      io.to(`chat:${sessionId}`).emit('chat:message', messageJson);
      io.to('chat:admins').emit('chat:session-updated', sessionJson);
      if (socket.role !== 'admin') io.to('chat:admins').emit('chat:incoming-message', { session: sessionJson, message: messageJson });
      callback?.({ ok: true, message: messageJson, session: sessionJson });
    } catch (error) {
      callback?.({ ok: false, message: error instanceof Error ? error.message : 'Could not send message.' });
    }
  });

  socket.on('webrtc:offer', ({ callId, offer } = {}) => {
    const call = activeCalls.get(callId);
    if (!call || socket.id !== call.customerSocketId || !call.adminSocketId) return;
    io.to(call.adminSocketId).emit('webrtc:offer', { callId, offer });
  });

  socket.on('webrtc:answer', ({ callId, answer } = {}) => {
    const call = activeCalls.get(callId);
    if (!call || socket.id !== call.adminSocketId) return;
    io.to(call.customerSocketId).emit('webrtc:answer', { callId, answer });
  });

  socket.on('webrtc:ice-candidate', ({ callId, candidate } = {}) => {
    const call = activeCalls.get(callId);
    if (!call) return;
    if (socket.id === call.customerSocketId && call.adminSocketId) {
      io.to(call.adminSocketId).emit('webrtc:ice-candidate', { callId, candidate });
    } else if (socket.id === call.adminSocketId) {
      io.to(call.customerSocketId).emit('webrtc:ice-candidate', { callId, candidate });
    }
  });

  socket.on('call:end', ({ callId } = {}) => {
    const call = activeCalls.get(callId || socket.data.callId);
    if (!call) return;
    if (socket.id !== call.customerSocketId && socket.id !== call.adminSocketId && socket.role !== 'admin') return;

    const nextStatus = call.status === 'accepted' ? 'ended' : socket.role === 'admin' ? 'rejected' : 'cancelled';
    markCallHistory(call, nextStatus, socket.role === 'admin' ? 'Ended by admin' : 'Ended by caller', socket)
      .then((history) => { if (history) io.to('admins').emit('admin:call-history-updated', normalizeCallHistory(history)); })
      .catch(() => {});
    activeCalls.delete(call.callId);
    io.to(call.callId).emit('call:ended', { callId: call.callId });
    broadcastAdminCalls();
  });

  socket.on('disconnect', () => {
    if (socket.role === 'admin') admins.delete(socket.id);

    for (const call of activeCalls.values()) {
      if (call.customerSocketId === socket.id || call.adminSocketId === socket.id) {
        const nextStatus = call.status === 'accepted' ? 'disconnected' : 'missed';
        markCallHistory(call, nextStatus, socket.role === 'admin' ? 'Admin disconnected' : 'Caller disconnected', socket)
          .then((history) => { if (history) io.to('admins').emit('admin:call-history-updated', normalizeCallHistory(history)); })
          .catch(() => {});
        activeCalls.delete(call.callId);
        io.to(call.callId).emit('call:ended', { callId: call.callId });
      }
    }

    broadcastAdminCalls();
  });
});

mongoose.connect(MONGODB_URI)
  .then(async () => {
    await seedDatabase();
    server.listen(PORT, () => {
      console.log(`MongoDB portfolio server with live calls running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection failed:', error);
    process.exit(1);
  });
