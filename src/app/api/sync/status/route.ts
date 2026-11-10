import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
import {gamobConfigurationStatus} from '@/lib/gamob';
export async function GET(){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const [jobs,apps,adUnits,lastSuccess]=await Promise.all([
  prisma.syncJob.findMany({orderBy:{startedAt:'desc'},take:30,include:{application:true}}),
  prisma.application.count(),prisma.adUnit.count(),
  prisma.syncJob.findFirst({where:{status:'SUCCESS'},orderBy:{finishedAt:'desc'}})
 ]);
 return NextResponse.json({configuration:gamobConfigurationStatus(),applications:apps,adUnits,lastSuccess:lastSuccess?.finishedAt||null,jobs});
}
