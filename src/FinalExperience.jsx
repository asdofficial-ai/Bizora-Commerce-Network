import React, { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, Banknote, BriefcaseBusiness,
  CheckCircle2, CircleDollarSign, CreditCard, LayoutDashboard, LifeBuoy,
  LockKeyhole, RefreshCcw, Scale, ShieldCheck, UserCheck, Users, WalletCards
} from 'lucide-react'
import { api } from './api.js'
import { useAuth } from './AuthContext.jsx'
import './final.css'

function Frame({children,title,subtitle,back='/'}){
  const {user,logout}=useAuth()
  return <main className="final-page">
    <header className="final-header"><div className="final-shell final-header-inner"><Link to={back} className="final-back"><ArrowLeft size={18}/></Link><Link to="/" className="final-brand"><span>B</span><b>Bizora Commerce</b></Link><div className="final-user">{user&&<><small>{user.role}</small><b>{user.name}</b><button onClick={logout}>Sign out</button></>}</div></div></header>
    <section className="final-shell final-intro"><div><span className="final-kicker">INSPECTION BUILD</span><h1>{title}</h1><p>{subtitle}</p></div><div className="sandbox-pill"><LockKeyhole size={14}/> Sandbox • no real money</div></section>
    <div className="final-shell">{children}</div>
  </main>
}
function Loading(){return <div className="final-loading"><div className="final-spinner"/>Loading…</div>}
function Require({role,children}){const{user,loading}=useAuth();if(loading)return <Loading/>;if(!user)return <Navigate to="/auth" replace/>;if(role&&user.role!==role)return <Navigate to={user.role==='merchant'?'/dashboard':'/account'} replace/>;return children}
const money=n=>`₦${Number(n||0).toLocaleString()}`
const pretty=s=>String(s||'').replaceAll('_',' ')
function Metric({icon:Icon,label,value,note}){return <article className="final-metric"><Icon/><span>{label}</span><strong>{value}</strong><small>{note}</small></article>}

export function CustomerHub(){
  const{token}=useAuth();const[data,setData]=useState({requests:[],payments:[],disputes:[],verification:null});const[error,setError]=useState('')
  async function load(){try{const[r,p,d,v]=await Promise.all([api('/api/requests',{},token),api('/api/payments',{},token),api('/api/disputes',{},token),api('/api/verification',{},token)]);setData({requests:r.requests||[],payments:p.payments||[],disputes:d.disputes||[],verification:v.verification||null});setError('')}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[token])
  const held=data.payments.filter(p=>p.status==='held').reduce((s,p)=>s+Number(p.amount||0),0)
  return <Require role="customer"><Frame title="Your Bizora account" subtitle="Requests, sandbox escrow, verification, disputes and support in one place.">
    {error&&<div className="final-error">{error}</div>}
    <section className="final-metrics"><Metric icon={BriefcaseBusiness} label="Requests" value={data.requests.length} note="Service requests"/><Metric icon={WalletCards} label="Held" value={money(held)} note="Sandbox escrow"/><Metric icon={ShieldCheck} label="Verification" value={data.verification?.status==='verified'?'Verified':'Required'} note="No real ID collected"/><Metric icon={Scale} label="Disputes" value={data.disputes.filter(d=>d.status==='open').length} note="Open cases"/></section>
    <section className="final-actions"><Link to="/marketplace"><BriefcaseBusiness/><span><b>Find a service</b><small>Browse providers and create a request</small></span><ArrowRight/></Link><Link to="/verify"><UserCheck/><span><b>Verification</b><small>Complete the safe sandbox check</small></span><ArrowRight/></Link><Link to="/payments"><CreditCard/><span><b>Payments & escrow</b><small>Create and release sandbox payments</small></span><ArrowRight/></Link><Link to="/disputes"><Scale/><span><b>Disputes</b><small>Raise and track payment issues</small></span><ArrowRight/></Link><Link to="/support"><LifeBuoy/><span><b>Customer support</b><small>AI first, human handoff when needed</small></span><ArrowRight/></Link></section>
    <section className="final-grid"><div className="final-panel"><div className="final-panel-head"><h2>Recent requests</h2><button onClick={load}><RefreshCcw size={15}/></button></div>{data.requests.length?data.requests.slice(0,6).map(r=><div className="final-row" key={r.id}><div><b>{r.service}</b><small>{r.provider_name}</small></div><span className="final-status">{pretty(r.status)}</span></div>):<p className="final-empty">No requests yet. Start from Services.</p>}</div><div className="final-panel"><h2>Recent payments</h2>{data.payments.length?data.payments.slice(0,6).map(p=><div className="final-row" key={p.id}><div><b>{money(p.amount)}</b><small>{p.provider_name}</small></div><span className={`final-status ${p.status}`}>{p.status}</span></div>):<p className="final-empty">No sandbox payments yet.</p>}</div></section>
  </Frame></Require>
}

export function MerchantHub(){
  const{token,merchant}=useAuth();const[stats,setStats]=useState(null);const[payments,setPayments]=useState([]);const[verification,setVerification]=useState(null);const[error,setError]=useState('')
  async function load(){try{const[s,p,v]=await Promise.all([api('/api/merchant/stats',{},token),api('/api/payments',{},token),api('/api/verification',{},token)]);setStats(s);setPayments(p.payments||[]);setVerification(v.verification);setError('')}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[token])
  return <Require role="merchant"><Frame title={merchant?.business_name||'Merchant dashboard'} subtitle="Manage leads, verification and sandbox transaction visibility.">
    {error&&<div className="final-error">{error}</div>}
    <section className="final-metrics"><Metric icon={BriefcaseBusiness} label="New requests" value={stats?.stats?.newRequests||0} note="Awaiting quote"/><Metric icon={LayoutDashboard} label="Active jobs" value={stats?.stats?.activeJobs||0} note="Accepted / in progress"/><Metric icon={Banknote} label="Held" value={money(stats?.stats?.heldValue)} note="Sandbox escrow"/><Metric icon={CircleDollarSign} label="Released" value={money(stats?.stats?.releasedValue)} note="Inspection earnings"/></section>
    <section className="final-actions merchant-actions"><Link to="/sell"><BriefcaseBusiness/><span><b>Business profile</b><small>Edit your service business details</small></span><ArrowRight/></Link><Link to="/verify"><BadgeCheck/><span><b>Business verification</b><small>{verification?.status==='verified'?'Verified':'Complete sandbox verification'}</small></span><ArrowRight/></Link><Link to="/payments"><WalletCards/><span><b>Transaction ledger</b><small>Inspect held and released payments</small></span><ArrowRight/></Link><Link to="/support"><LifeBuoy/><span><b>Customer support</b><small>Open Bizora support</small></span><ArrowRight/></Link></section>
    <section className="final-panel"><div className="final-panel-head"><h2>Latest service requests</h2><button onClick={load}><RefreshCcw size={15}/></button></div>{stats?.requests?.length?stats.requests.map(r=><div className="final-row" key={r.id}><div><b>{r.service}</b><small>{r.provider_name} • {r.location}</small></div><span className="final-status">{pretty(r.status)}</span></div>):<p className="final-empty">No service requests yet.</p>}</section>
  </Frame></Require>
}

export function VerificationPage(){
  const{token,user,refresh}=useAuth();const[verification,setVerification]=useState(null);const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('')
  async function load(){try{const d=await api('/api/verification',{},token);setVerification(d.verification)}catch(e){setMsg(e.message)}}
  useEffect(()=>{if(token)load()},[token])
  async function complete(method){setBusy(true);setMsg('');try{const d=await api('/api/verification/sandbox-complete',{method:'POST',body:JSON.stringify({method})},token);setVerification(d.verification);setMsg(d.warning);await refresh()}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  return <Require><Frame title={user?.role==='merchant'?'Business verification':'Identity verification'} subtitle="A safe inspection workflow that proves the product flow without collecting real government identifiers." back={user?.role==='merchant'?'/dashboard':'/account'}>
    <section className="final-panel verification-panel"><div className={`verification-mark ${verification?.status==='verified'?'done':''}`}>{verification?.status==='verified'?<CheckCircle2/>:<ShieldCheck/>}</div><h2>{verification?.status==='verified'?'Sandbox verification complete':'Ready for verification'}</h2><p>For tomorrow’s inspection, Bizora simulates the verification result. <b>Do not enter a real NIN or BVN here.</b> Production verification will be connected to an approved identity provider.</p>{verification?.status==='verified'?<div className="verified-box"><BadgeCheck/> Verified • {verification.method}</div>:user?.role==='merchant'?<button className="final-primary" disabled={busy} onClick={()=>complete('BUSINESS')}>Complete business sandbox check</button>:<div className="verify-buttons"><button disabled={busy} onClick={()=>complete('NIN')}>Simulate NIN check</button><button disabled={busy} onClick={()=>complete('BVN')}>Simulate BVN check</button></div>}{msg&&<div className="final-note">{msg}</div>}</section>
  </Frame></Require>
}

export function PaymentsPage(){
  const{token,user}=useAuth();const[requests,setRequests]=useState([]);const[payments,setPayments]=useState([]);const[verification,setVerification]=useState(null);const[selected,setSelected]=useState('');const[amount,setAmount]=useState('');const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false)
  async function load(){try{const[p,v]=await Promise.all([api('/api/payments',{},token),api('/api/verification',{},token)]);setPayments(p.payments||[]);setVerification(v.verification);if(user?.role==='customer'){const r=await api('/api/requests',{},token);setRequests(r.requests||[])}}catch(e){setMsg(e.message)}}
  useEffect(()=>{if(token)load()},[token,user?.role])
  const request=useMemo(()=>requests.find(r=>r.id===selected),[requests,selected])
  useEffect(()=>{if(request?.quote_amount)setAmount(String(request.quote_amount))},[selected])
  async function create(){setBusy(true);setMsg('');try{const d=await api('/api/payments',{method:'POST',body:JSON.stringify({requestId:selected,amount:Number(amount)})},token);setMsg(d.warning||'Sandbox payment created.');await load()}catch(e){setMsg(e.message==='verification_required'?'Complete verification before creating a sandbox payment.':e.message)}finally{setBusy(false)}}
  async function release(id){setBusy(true);setMsg('');try{await api(`/api/payments/${id}/release`,{method:'POST'},token);setMsg('Sandbox escrow released.');await load()}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  return <Require><Frame title="Payments & escrow" subtitle="Inspection-only transaction flow. No card, bank account or real money is used." back={user?.role==='merchant'?'/dashboard':'/account'}>
    {!verification&&<div className="final-warning"><AlertTriangle/><span>Verification is required before a customer can create sandbox escrow.</span><Link to="/verify">Verify</Link></div>}
    {user?.role==='customer'&&<section className="final-panel payment-create"><h2>Create sandbox escrow</h2><p>Select one of your service requests and choose the inspection amount.</p><label>Service request<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose request</option>{requests.map(r=><option value={r.id} key={r.id}>{r.service} — {r.provider_name}</option>)}</select></label><label>Amount (NGN)<input inputMode="numeric" value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,''))} placeholder="10000"/></label><button className="final-primary" disabled={busy||!selected||!amount} onClick={create}>Hold sandbox funds</button></section>}
    {msg&&<div className="final-note">{msg}</div>}
    <section className="final-panel"><h2>Transaction ledger</h2>{payments.length?payments.map(p=><div className="payment-row" key={p.id}><div><b>{money(p.amount)}</b><small>{p.provider_name} • {p.currency}</small></div><span className={`final-status ${p.status}`}>{p.status}</span>{user?.role==='customer'&&p.status==='held'&&<button disabled={busy} onClick={()=>release(p.id)}>Release</button>}</div>):<p className="final-empty">No transactions yet.</p>}</section>
  </Frame></Require>
}

export function DisputesPage(){
  const{token}=useAuth();const[payments,setPayments]=useState([]);const[disputes,setDisputes]=useState([]);const[paymentId,setPaymentId]=useState('');const[reason,setReason]=useState('');const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false)
  async function load(){try{const[p,d]=await Promise.all([api('/api/payments',{},token),api('/api/disputes',{},token)]);setPayments((p.payments||[]).filter(x=>x.status!=='refunded'));setDisputes(d.disputes||[])}catch(e){setMsg(e.message)}}
  useEffect(()=>{if(token)load()},[token])
  async function open(){setBusy(true);setMsg('');try{await api('/api/disputes',{method:'POST',body:JSON.stringify({paymentId,reason})},token);setReason('');setPaymentId('');setMsg('Dispute opened for review.');await load()}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  return <Require role="customer"><Frame title="Disputes" subtitle="Raise a sandbox payment issue and track the resolution state." back="/account">
    <section className="final-panel payment-create"><h2>Open a dispute</h2><label>Payment<select value={paymentId} onChange={e=>setPaymentId(e.target.value)}><option value="">Choose payment</option>{payments.map(p=><option value={p.id} key={p.id}>{money(p.amount)} — {p.provider_name} — {p.status}</option>)}</select></label><label>What happened?<textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="Describe the problem clearly…"/></label><button className="final-primary" disabled={busy||!paymentId||reason.trim().length<10} onClick={open}>Submit dispute</button></section>{msg&&<div className="final-note">{msg}</div>}<section className="final-panel"><h2>Your cases</h2>{disputes.length?disputes.map(d=><div className="final-row" key={d.id}><div><b>{d.provider_name||d.payment_id}</b><small>{d.reason}</small></div><span className={`final-status ${d.status}`}>{d.status}{d.resolution?` • ${d.resolution}`:''}</span></div>):<p className="final-empty">No disputes.</p>}</section>
  </Frame></Require>
}

export function AdminPage(){
  const[key,setKey]=useState(()=>localStorage.getItem('bizora-admin-key')||'');const[data,setData]=useState(null);const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false)
  async function load(){setBusy(true);setMsg('');try{const d=await api('/api/admin/overview',{headers:{'x-admin-key':key}});setData(d);localStorage.setItem('bizora-admin-key',key)}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  async function resolve(id,action){setBusy(true);try{await api(`/api/admin/disputes/${id}/resolve`,{method:'POST',headers:{'x-admin-key':key},body:JSON.stringify({action})});await load()}catch(e){setMsg(e.message)}finally{setBusy(false)}}
  return <main className="final-page"><header className="final-header"><div className="final-shell final-header-inner"><Link to="/" className="final-back"><ArrowLeft size={18}/></Link><Link to="/" className="final-brand"><span>B</span><b>Bizora Admin</b></Link></div></header><section className="final-shell final-intro"><div><span className="final-kicker">INTERNAL CONTROL CENTER</span><h1>Admin inspection</h1><p>Sandbox oversight for transactions, disputes and verification records.</p></div></section><div className="final-shell"><section className="final-panel admin-login"><input type="password" value={key} onChange={e=>setKey(e.target.value)} placeholder="Admin passcode"/><button className="final-primary" onClick={load} disabled={busy||!key}>Open admin</button></section>{msg&&<div className="final-error">{msg}</div>}{data&&<><section className="final-metrics"><Metric icon={Users} label="Users" value={data.overview.users} note="Registered accounts"/><Metric icon={BriefcaseBusiness} label="Requests" value={data.overview.requests} note="Service requests"/><Metric icon={Banknote} label="Held" value={money(data.overview.heldValue)} note="Sandbox escrow"/><Metric icon={Scale} label="Open disputes" value={data.overview.openDisputes} note="Need review"/></section><section className="final-panel"><h2>Dispute queue</h2>{data.disputes.filter(d=>d.status==='open').length?data.disputes.filter(d=>d.status==='open').map(d=><div className="admin-dispute" key={d.id}><div><b>{d.reason}</b><small>{d.payment_id}</small></div><div><button onClick={()=>resolve(d.id,'refund')}>Refund</button><button onClick={()=>resolve(d.id,'release')}>Release</button><button onClick={()=>resolve(d.id,'dismiss')}>Dismiss</button></div></div>):<p className="final-empty">No open disputes.</p>}</section></>}</div></main>
}
