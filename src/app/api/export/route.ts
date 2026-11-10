import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export const runtime = 'nodejs';
export async function GET(req:Request) {
  if (!await isAdmin()) return NextResponse.json({error:'Unauthorized'},{status:401});
  const u = new URL(req.url);
  const format = u.searchParams.get('format') || 'csv';
  const appId = u.searchParams.get('appId');
  const period = u.searchParams.get('period');
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const where:any = appId && appId !== 'all' ? {applicationId:appId} : {};
  if (period === 'month') where.date = { gte: monthStart, lte: now };
  const rows = await prisma.revenueDaily.findMany({
    where,
    include:{application:true}, orderBy:{date:'asc'}
  });
  if (format === 'csv') {
    const esc=(s:string)=>`"${s.replaceAll('"','""')}"`;
    const lines=[['Application','Package','Date','GAMOB reported revenue','Currency'].map(esc).join(','),...rows.map(r=>[r.application.name,r.application.packageName,r.date.toISOString().slice(0,10),r.amount.toString(),r.currency].map(esc).join(','))];
    return new NextResponse(lines.join('\r\n'),{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="gamob-revenue.csv"'}});
  }
  if (format === 'xlsx') {
    const wb=new ExcelJS.Workbook(); const ws=wb.addWorksheet('GAMOB Revenue');
    ws.columns=[{header:'Application',key:'app',width:24},{header:'Package',key:'package',width:28},{header:'Date',key:'date',width:16},{header:'Reported Revenue',key:'amount',width:22},{header:'Currency',key:'currency',width:12}];
    rows.forEach(r=>ws.addRow({app:r.application.name,package:r.application.packageName,date:r.date.toISOString().slice(0,10),amount:r.amount.toString(),currency:r.currency}));
    ws.getRow(1).font={bold:true,color:{argb:'FFFFFFFF'}}; ws.getRow(1).fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF315CF5'}};
    const buf=await wb.xlsx.writeBuffer();
    return new NextResponse(buf,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="gamob-revenue.xlsx"'}});
  }
  if (format === 'pdf') {
    const doc=new PDFDocument({size:'A4',margin:48}); const chunks:Buffer[]=[];
    doc.on('data',(c:Buffer)=>chunks.push(c));
    const done=new Promise<Buffer>(resolve=>doc.on('end',()=>resolve(Buffer.concat(chunks))));
    doc.fontSize(20).fillColor('#172033').text('T2Dev Monetization Center');
    doc.moveDown(.3).fontSize(10).fillColor('#64748b').text(`${period==='month'?'Monthly':'All-time'} GAMOB-reported revenue statement · No additional deduction applied`);
    doc.moveDown().fontSize(9).fillColor('#172033');
    rows.forEach(r=>doc.text(`${r.application.name} | ${r.date.toISOString().slice(0,10)} | ${r.amount.toString()} ${r.currency}`));
    doc.end(); const buf=await done;
    return new NextResponse(new Uint8Array(buf),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="t2dev-monthly-revenue-report.pdf"'}});
  }
  return NextResponse.json({error:'Unsupported format. Use csv, xlsx or pdf.'},{status:400});
}
