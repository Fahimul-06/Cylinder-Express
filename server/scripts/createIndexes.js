import mongoose from 'mongoose';
import { config } from '../config/env.js';
import { models } from '../models/index.js';

async function main() {
  await mongoose.connect(config.MONGODB_URI, {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10_000,
  });
  for (const [name, Model] of Object.entries(models)) {
    await Model.createIndexes();
    console.log(`Indexes ready: ${name}`);
  }
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('Index creation failed:', error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
