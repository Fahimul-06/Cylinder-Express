import crypto from 'crypto';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { config } from './config/env.js';
import { models } from './models/index.js';
import { backfillProfileRolesAndPermissions, backfillOrderUserIds, ensureAdministrationHeadAccount, ensureDefaultCatalog, ensureEmployeeCodeIndex, runOrderAlertChecks, runLpgEmptyReminderChecks } from './services/runtime.js';

const instanceId = `${process.pid}-${crypto.randomUUID()}`;
const timers = [];
let server;
let shuttingDown = false;

async function runWithDistributedLock(name, lockMs, task) {
  const now = new Date();
  const lockedUntil = new Date(Date.now() + lockMs);
  try {
    const lock = await models.job_locks.findOneAndUpdate(
      { name, $or: [{ locked_until: { $lte: now } }, { owner: instanceId }] },
      { $set: { owner: instanceId, locked_until: lockedUntil, updated_at: now }, $setOnInsert: { name } },
      { new: true, upsert: true }
    );
    if (!lock || lock.owner !== instanceId) return false;
    await task();
    await models.job_locks.updateOne({ name, owner: instanceId }, { $set: { locked_until: new Date(), updated_at: new Date() } });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

function scheduleJob(name, intervalMs, lockMs, task) {
  let running = false;
  const execute = async () => {
    if (running || shuttingDown || mongoose.connection.readyState !== 1) return;
    running = true;
    try { await runWithDistributedLock(name, lockMs, task); }
    catch (error) { console.error(JSON.stringify({ level: 'error', job: name, message: error.message })); }
    finally { running = false; }
  };
  execute();
  const timer = setInterval(execute, intervalMs);
  timer.unref?.();
  timers.push(timer);
}

async function startServer() {
  mongoose.set('strictQuery', true);
  await mongoose.connect(config.MONGODB_URI, {
    maxPoolSize: config.MONGODB_MAX_POOL_SIZE,
    minPoolSize: config.MONGODB_MIN_POOL_SIZE,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    maxIdleTimeMS: 60_000,
    retryWrites: true,
  });

  await ensureDefaultCatalog();
  await ensureEmployeeCodeIndex();
  await ensureAdministrationHeadAccount();
  if (config.ENABLE_STARTUP_BACKFILLS) {
    await backfillProfileRolesAndPermissions();
    await backfillOrderUserIds();
  }

  scheduleJob('order-alert-checks', 30_000, 25_000, runOrderAlertChecks);
  scheduleJob('lpg-empty-reminders', 6 * 60 * 60 * 1000, 30 * 60 * 1000, runLpgEmptyReminderChecks);

  server = createApp().listen(config.PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ level: 'info', message: 'Cylinder Express API started', port: config.PORT, instanceId }));
  });
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;
  server.requestTimeout = config.REQUEST_TIMEOUT_MS + 5_000;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(JSON.stringify({ level: 'info', message: 'Graceful shutdown started', signal }));
  timers.forEach(clearInterval);
  const forceExit = setTimeout(() => process.exit(1), 15_000);
  forceExit.unref?.();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(forceExit);
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (reason) => console.error(JSON.stringify({ level: 'error', type: 'unhandledRejection', reason: String(reason) })));
process.on('uncaughtException', (error) => { console.error(JSON.stringify({ level: 'fatal', type: 'uncaughtException', message: error.message })); shutdown('uncaughtException'); });

startServer().catch((error) => { console.error(JSON.stringify({ level: 'fatal', message: 'Startup failed', error: error.message })); process.exit(1); });
