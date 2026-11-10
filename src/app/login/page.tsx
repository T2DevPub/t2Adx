'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ShieldCheck, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
 const [username,setUsername]=useState(''); const [password,setPassword]=useState('');
 const [show,setShow]=useState(false); const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');
  try { const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
   const data=await r.json(); if(!r.ok) throw new Error(data.error||'Login failed'); window.location.href='/dashboard';
  } catch(err){setError(err instanceof Error?err.message:'Unable to sign in');} finally{setBusy(false);}
 }
 return <main className="min-h-screen grid lg:grid-cols-[1.05fr_.95fr] bg-[#f7f7f8]">
  <section className="hidden lg:flex flex-col justify-between p-14 text-[#1b2942] relative overflow-hidden border-r border-[#e7e7e9]" style={{background:'radial-gradient(circle at 18% 12%,rgba(75,76,82,.09),transparent 38%),radial-gradient(circle at 85% 88%,rgba(120,121,126,.08),transparent 34%),linear-gradient(145deg,#ffffff,#f5f5f6)'}}>
   <div className="absolute -right-36 -bottom-36 w-[620px] h-[620px] rounded-full border border-[#e1e1e3]"/><div className="absolute right-12 bottom-16 w-[380px] h-[380px] rounded-full border border-[#e1e1e3]"/>
   <div><Image src="/logo-original.png" alt="T2Dev logo" width={190} height={92} className="object-contain"/></div>
   <div className="relative max-w-xl"><div className="text-[#55565c] text-xs tracking-[.24em] font-semibold mb-5">T2DEV MONETIZATION CENTER</div><h1 className="text-5xl leading-[1.12] font-semibold tracking-tight">Your apps.<br/>One clear view<br/>of revenue.</h1><p className="text-slate-500 mt-6 text-lg leading-8 max-w-md">A focused workspace for GAMOB reporting, application performance and payment reconciliation.</p></div>
   <div className="flex items-center gap-2 text-slate-500 text-sm"><ShieldCheck size={16}/> Secure administrator access</div>
  </section>
  <section className="flex items-center justify-center px-6 py-12 bg-[#f7f7f8]">
   <div className="w-full max-w-[420px]">
    <div className="lg:hidden mb-10"><Image src="/logo-original.png" alt="T2Dev logo" width={145} height={70} className="object-contain"/></div>
    <div className="mb-9"><div className="text-xs uppercase tracking-[.18em] text-[#55565c] font-bold mb-3">Administrator portal</div><h2 className="text-3xl font-semibold tracking-tight text-[#172033]">Welcome back</h2><p className="text-sm text-slate-500 mt-2">Sign in to manage your monetization workspace.</p></div>
    <form onSubmit={submit} className="bg-white border border-slate-200/80 rounded-2xl p-7 shadow-[0_18px_55px_rgba(45,45,50,.08)] space-y-5">
     <div><label className="block text-sm font-medium text-slate-700 mb-2">Username</label><input className="input" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required placeholder="Administrator username"/></div>
     <div><label className="block text-sm font-medium text-slate-700 mb-2">Password</label><div className="relative"><input className="input pr-11" type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Your password"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-3 top-3 text-slate-400">{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
     {error&&<div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{error}</div>}
     <button disabled={busy} className="btn w-full py-3 bg-[#55565c] text-white hover:bg-[#3f4045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#77787d] focus-visible:ring-offset-2">{busy?'Signing in...':'Sign in securely'} <ArrowRight size={16}/></button>
    </form>
    <p className="text-xs text-center text-slate-400 mt-7">T2Dev Monetization Center · Private workspace</p>
   </div>
  </section>
 </main>;
}
