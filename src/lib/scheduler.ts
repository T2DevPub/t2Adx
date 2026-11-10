import cron from 'node-cron';
import { prisma } from './prisma';
import { syncApplication, gamobConfigurationStatus } from './gamob';

let started = false;
let running = false;
export function startScheduler() {
  if (started || process.env.NODE_ENV !== 'production') return;
  started = true;
  const minutes = Math.max(5, Math.min(60, Number(process.env.GAMOB_SYNC_INTERVAL_MINUTES || 15)));
  const run = async () => {
    if (running || !gamobConfigurationStatus().configured) return;
    running = true;
    try {
      const apps = await prisma.application.findMany({where:{enabled:true,gamobAppId:{not:null}}});
      for (const app of apps) {
        const job = await prisma.syncJob.create({data:{applicationId:app.id,status:'RUNNING'}});
        try {
          const result = await syncApplication(app.id);
          await prisma.syncJob.update({where:{id:job.id},data:{status:'SUCCESS',finishedAt:new Date(),recordsFetched:result.recordsFetched,details:{startDate:result.startDate,endDate:result.endDate}}});
        } catch (e) {
          await prisma.syncJob.update({where:{id:job.id},data:{status:'FAILED',finishedAt:new Date(),message:e instanceof Error?e.message:'Unknown sync error'}});
        }
      }
    } finally { running = false; }
  };
  void run();
  cron.schedule(`*/${minutes} * * * *`, () => { void run(); });
}
