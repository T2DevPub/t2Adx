import {NextResponse} from 'next/server';
import {isAdmin} from '@/lib/auth';
import {prisma} from '@/lib/prisma';
export async function GET(req:Request){
 if(!await isAdmin())return NextResponse.json({error:'Unauthorized'},{status:401});
 const u=new URL(req.url),appId=u.searchParams.get('appId'),range=u.searchParams.get('range')||'30';
 const days=Math.max(1,Math.min(366,Number(range)||30)),from=new Date(Date.now()-(days-1)*86400000);
 const rows=await prisma.countryMetric.findMany({where:{date:{gte:from},...(appId&&appId!=='all'?{applicationId:appId}:{})},include:{application:true},orderBy:{revenue:'desc'}});
 const groups=new Map<string,any>();
 for(const r of rows){const key=`${r.countryCode}|${r.currency}`;const v=groups.get(key)||{countryCode:r.countryCode,countryName:r.countryName,currency:r.currency,revenue:0,impressions:0,clicks:0,ecpmWeighted:0,apps:new Set<string>()};v.revenue+=Number(r.revenue||0);v.impressions+=Number(r.impressions||0n);v.clicks+=Number(r.clicks||0n);v.ecpmWeighted+=Number(r.ecpm||0)*Number(r.impressions||0n);v.apps.add(r.application.name);groups.set(key,v);}
 return NextResponse.json([...groups.values()].map(v=>({...v,ecpm:v.impressions?v.ecpmWeighted/v.impressions:0,apps:[...v.apps]})).sort((a,b)=>b.revenue-a.revenue));
}
