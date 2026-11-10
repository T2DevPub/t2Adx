import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {syncApplication} from '@/lib/gamob';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req:Request){
  const authorized=await isAdmin()||(!!process.env.SYNC_SECRET&&req.headers.get('x-sync-secret')===process.env.SYNC_SECRET);
  if(!authorized)return NextResponse.json({error:'Unauthorized'},{status:401});
  const mode=new URL(req.url).searchParams.get('history');
  const fullHistory=mode==='all'||mode==='90d';
  const apps=await prisma.application.findMany({where:{enabled:true, gamobAppId:{not:null}}});
  const results=[];
  for(const app of apps){
    const job=await prisma.syncJob.create({data:{applicationId:app.id,status:'RUNNING'}});
    try{
      const result=await syncApplication(app.id,fullHistory);
      await prisma.syncJob.update({where:{id:job.id},data:{status:'SUCCESS',finishedAt:new Date(),recordsFetched:result.recordsFetched,details:{startDate:result.startDate,endDate:result.endDate,mode:fullHistory?'historical':'recent'}}});
      results.push({app:app.name,status:'SUCCESS',recordsFetched:result.recordsFetched,startDate:result.startDate,endDate:result.endDate});
    }catch(e){
      const message=e instanceof Error?e.message:'Unknown error';
      await prisma.syncJob.update({where:{id:job.id},data:{status:'FAILED',finishedAt:new Date(),message}});
      results.push({app:app.name,status:'FAILED',message});
    }
  }
  return NextResponse.json({results,history:fullHistory?'historical':'7d',applications:apps.length});
}
