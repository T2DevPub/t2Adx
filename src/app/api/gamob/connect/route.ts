import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {connectGamob,syncApplication} from '@/lib/gamob';
export const runtime='nodejs';
export const maxDuration=300;
export async function POST(){
  if(!await isAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401});
  try {
    const connected=await connectGamob();
    const apps=await prisma.application.findMany({where:{enabled:true,gamobAppId:{not:null}}});
    const syncResults=[];
    for(const app of apps){
      const job=await prisma.syncJob.create({data:{applicationId:app.id,status:'RUNNING'}});
      try {
        const result=await syncApplication(app.id,true);
        await prisma.syncJob.update({where:{id:job.id},data:{status:'SUCCESS',finishedAt:new Date(),recordsFetched:result.recordsFetched,details:{startDate:result.startDate,endDate:result.endDate,mode:'initial'}}});
        syncResults.push({app:app.name,status:'SUCCESS',recordsFetched:result.recordsFetched});
      } catch(e) {
        const message=e instanceof Error?e.message:'Unknown sync error';
        await prisma.syncJob.update({where:{id:job.id},data:{status:'FAILED',finishedAt:new Date(),message}});
        syncResults.push({app:app.name,status:'FAILED',message});
      }
    }
    return NextResponse.json({ok:true,...connected,syncResults});
  } catch(e) {
    return NextResponse.json({error:e instanceof Error?e.message:'GAMOB connection failed.'},{status:502});
  }
}
