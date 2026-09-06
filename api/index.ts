process.env.VERCEL = '1';
import { app } from '../server';
import { seedInitialData } from '../server/db';

let isSeeded = false;

export default async function handler(req: any, res: any) {
  if (!isSeeded) {
    try {
      await seedInitialData();
      isSeeded = true;
    } catch (e) {
      console.error('Initial data seed error in serverless handler:', e);
    }
  }
  return app(req, res);
}
