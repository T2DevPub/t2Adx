import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req:Request) {
  if (!await isAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401});
  const u=new URL(req.url);
  const appId=u.searchParams.get('appId');
  const range=u.searchParams.get('range') || '7';
  const now=new Date();
  let from=new Date(now);
  if (range==='today') from=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  else if (range==='month') from=new Date(now.getFullYear(),now.getMonth(),1);
  else from=new Date(now.getTime()-(Math.max(1,Number(range)||7)-1)*86400000);
  const where:any={date:{gte:from,lte:now}};
  if (appId && appId!=='all') where.applicationId=appId;
  const rows=await prisma.revenueDaily.findMany({where,include:{application:true},orderBy:{date:'asc'}});
  const totals:Record<string,Prisma.Decimal>={};
  for (const r of rows) totals[r.currency]=(totals[r.currency]||new Prisma.Decimal(0)).plus(r.amount);
  const payments=await prisma.payment.findMany({where:appId&&appId!=='all'?{applicationId:appId}:{}});
  const paid:Record<string,Prisma.Decimal>={};
  for (const p of payments) paid[p.currency]=(paid[p.currency]||new Prisma.Decimal(0)).plus(p.amount);
  const metrics=await prisma.adMetricDaily.findMany({where:{date:where.date,...(appId&&appId!=='all'?{applicationId:appId}:{})}});
  const sum=(k:'impressions'|'requests'|'clicks')=>metrics.reduce((n,m)=>n+Number(m[k]||0n),0);
  return NextResponse.json({
    revenue:Object.fromEntries(Object.entries(totals).map(([k,v])=>[k,v.toString()])),
    paid:Object.fromEntries(Object.entries(paid).map(([k,v])=>[k,v.toString()])),
    metrics:{impressions:sum('impressions'),requests:sum('requests'),clicks:sum('clicks')},
    series:rows.map(r=>({date:r.date.toISOString().slice(0,10),amount:r.amount.toString(),currency:r.currency,application:r.application.name}))
  });
}
