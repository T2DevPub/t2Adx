import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
export async function GET(req:Request){
  if(!await isAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401});
  const u=new URL(req.url), appId=u.searchParams.get('appId'), type=u.searchParams.get('type')||'ad';
  const rows=await prisma.gamobBreakdown.findMany({
    where:{breakdownType:type,...(appId&&appId!=='all'?{applicationId:appId}:{})},
    include:{application:true},orderBy:{date:'desc'},take:2000
  });
  return NextResponse.json(rows.map(r=>({id:r.id,date:r.date.toISOString().slice(0,10),type:r.breakdownType,key:r.breakdownKey,label:r.label,dimensions:r.dimensions,metrics:r.metrics,application:r.application.name})));
}
