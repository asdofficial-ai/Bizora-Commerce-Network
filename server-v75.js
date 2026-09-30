import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import path from 'path'
import { fileURLToPath } from 'url'
import crypto from 'crypto'

const { Pool } = pg
const app = express()
const PORT = process.env.PORT || 10000
const JWT_SECRET = process.env.JWT_SECRET || 'preview-only-change-me'
const SUPPORT_AGENT_KEY = process.env.SUPPORT_AGENT_KEY || 'bizora-preview-agent'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

const usePostgres = Boolean(process.env.DATABASE_URL)
const pool = usePostgres ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }) : null
const memory = { users:[], merchants:[], requests:[], messages:[], supportTickets:[], supportMessages:[] }

const id = prefix => `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0,18)}`
const publicUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role, createdAt:u.created_at || u.createdAt })
const sign = u => jwt.sign({ sub:u.id, role:u.role }, JWT_SECRET, { expiresIn:'7d' })

function supportWindow(){
  const parts = new Intl.DateTimeFormat('en-GB',{ timeZone:'Africa/Lagos', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(new Date())
  const hour = Number(parts.find(p=>p.type==='hour')?.value || 0)
  const minute = Number(parts.find(p=>p.type==='minute')?.value || 0)
  const open = hour >= 8 && hour < 20
  return { humanOpen:open, timezone:'Africa/Lagos', localTime:`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`, opensAt:'08:00', closesAt:'20:00', hoursPerDay:12 }
}

async function ensureSchema(){
  if(!pool) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('customer','merchant')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS merchant_profiles (
      id TEXT PRIMARY KEY, user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL, category TEXT NOT NULL, area TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'unverified',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_slug TEXT NOT NULL, provider_name TEXT NOT NULL, service TEXT NOT NULL,
      details TEXT NOT NULL, location TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending_quote',
      quote_amount INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ai_active', ai_confidence NUMERIC(4,3),
      assigned_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS support_messages (
      id TEXT PRIMARY KEY, ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
      sender_type TEXT NOT NULL CHECK(sender_type IN ('customer','ai','agent')),
      sender_name TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_requests_customer ON service_requests(customer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
    CREATE INDEX IF NOT EXISTS idx_support_customer ON support_tickets(customer_id);
    CREATE INDEX IF NOT EXISTS idx_support_messages_ticket ON support_messages(ticket_id);
  `)
}

async function findUserByEmail(email){ if(pool) return (await pool.query('SELECT * FROM users WHERE email=$1 LIMIT 1',[email])).rows[0]; return memory.users.find(u=>u.email===email) }
async function findUserById(userId){ if(pool) return (await pool.query('SELECT * FROM users WHERE id=$1 LIMIT 1',[userId])).rows[0]; return memory.users.find(u=>u.id===userId) }
async function createUser({name,email,passwordHash,role}){ const u={id:id('usr'),name,email,password_hash:passwordHash,role,created_at:new Date().toISOString()}; if(pool) return (await pool.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *',[u.id,name,email,passwordHash,role])).rows[0]; memory.users.push(u); return u }

async function auth(req,res,next){
  const token=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):null
  if(!token) return res.status(401).json({error:'Authentication required'})
  try{ const payload=jwt.verify(token,JWT_SECRET); const user=await findUserById(payload.sub); if(!user)return res.status(401).json({error:'Account no longer exists'}); req.user=user; next() }
  catch{return res.status(401).json({error:'Invalid or expired session'})}
}
function agentAuth(req,res,next){ if(req.headers['x-support-key']!==SUPPORT_AGENT_KEY)return res.status(401).json({error:'Invalid support staff passcode'}); next() }

async function getLatestRequest(userId){
  if(pool) return (await pool.query('SELECT * FROM service_requests WHERE customer_id=$1 ORDER BY created_at DESC LIMIT 1',[userId])).rows[0]||null
  return memory.requests.filter(r=>r.customer_id===userId).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null
}

function aiSupportAnswer(text, latestRequest){
  const q=text.toLowerCase()
  if(/human|person|agent|representative|real person|customer care/.test(q)) return {confidence:0, escalate:true, reply:'I’ll hand this conversation to a human support agent. You won’t need to repeat what you already told me.'}
  if(/track|status|order|request|job/.test(q)){
    if(latestRequest) return {confidence:.95, escalate:false, reply:`Your latest service request is “${latestRequest.service}” with ${latestRequest.provider_name}. Its current status is “${String(latestRequest.status).replaceAll('_',' ')}”. You can also see it in your customer account.`}
    return {confidence:.86, escalate:false, reply:'I can help track a request, but I cannot see a service request on this account yet. Create one from a provider page, then it will appear in your account.'}
  }
  if(/book|booking|service|provider|repair|clean|beauty|website/.test(q)) return {confidence:.91, escalate:false, reply:'To book a service, open the Services marketplace, choose a provider, select the service, describe what you need and submit the request. The request then appears in your account for tracking.'}
  if(/login|password|account|email|sign in|register/.test(q)) return {confidence:.87, escalate:false, reply:'For account access, use the Login / Sign up page. Passwords must be at least 8 characters. If you are locked out or your email cannot be accessed, I’ll need to escalate that to a human agent because account ownership must be handled carefully.'}
  if(/payment|pay|card|bank|wallet|escrow|payout|refund|money/.test(q)) return {confidence:.92, escalate:false, reply:'Payments, escrow, payouts and refunds are not live in this 75% build yet. Do not send money outside Bizora based on a message from a provider. Those transaction controls are part of the final 25%.'}
  if(/verify|verification|nin|bvn|identity|kyc/.test(q)) return {confidence:.9, escalate:false, reply:'Identity and business verification are planned for the final 25% of V1. The current build does not collect NIN or BVN, and you should not send those documents through chat.'}
  if(/cancel|complain|fraud|scam|unsafe|problem|issue|dispute/.test(q)) return {confidence:.62, escalate:true, reply:'This may need a person to review the details. I’m escalating the case to human support so it can be handled with the full conversation attached.'}
  if(/hello|hi|hey|good morning|good afternoon/.test(q)) return {confidence:.98, escalate:false, reply:'Hi. I’m Bizora Support AI. I can help with service requests, bookings, accounts, platform policies and support handoffs. What do you need help with?'}
  return {confidence:.28, escalate:true, reply:'I’m not confident enough to give you a reliable answer to that. I’m escalating the conversation instead of guessing.'}
}

async function insertSupportMessage(ticketId,senderType,senderName,body){
  const m={id:id('supmsg'),ticket_id:ticketId,sender_type:senderType,sender_name:senderName,body,created_at:new Date().toISOString()}
  if(pool) return (await pool.query('INSERT INTO support_messages(id,ticket_id,sender_type,sender_name,body) VALUES($1,$2,$3,$4,$5) RETURNING *',[m.id,ticketId,senderType,senderName,body])).rows[0]
  memory.supportMessages.push(m); return m
}
async function getSupportTicket(ticketId){ if(pool)return (await pool.query('SELECT t.*,u.name AS customer_name,u.email AS customer_email FROM support_tickets t JOIN users u ON u.id=t.customer_id WHERE t.id=$1',[ticketId])).rows[0]||null; const t=memory.supportTickets.find(t=>t.id===ticketId); if(!t)return null; const u=memory.users.find(u=>u.id===t.customer_id); return {...t,customer_name:u?.name,customer_email:u?.email} }
async function getSupportMessages(ticketId){ if(pool)return (await pool.query('SELECT * FROM support_messages WHERE ticket_id=$1 ORDER BY created_at ASC',[ticketId])).rows; return memory.supportMessages.filter(m=>m.ticket_id===ticketId).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)) }
async function updateTicket(ticketId,updates){
  if(pool){ const current=await getSupportTicket(ticketId); if(!current)return null; const status=updates.status??current.status, conf=updates.ai_confidence??current.ai_confidence, agent=updates.assigned_agent??current.assigned_agent; return (await pool.query('UPDATE support_tickets SET status=$1,ai_confidence=$2,assigned_agent=$3,updated_at=NOW() WHERE id=$4 RETURNING *',[status,conf,agent,ticketId])).rows[0] }
  const t=memory.supportTickets.find(t=>t.id===ticketId); if(!t)return null; Object.assign(t,updates,{updated_at:new Date().toISOString()}); return t
}
async function createSupportTicket(user,message){
  const latest=await getLatestRequest(user.id); const answer=aiSupportAnswer(message,latest); const window=supportWindow(); const status=answer.escalate?(window.humanOpen?'waiting_human':'queued_off_hours'):'ai_active'
  const ticket={id:id('sup'),customer_id:user.id,subject:message.slice(0,72),status,ai_confidence:answer.confidence,assigned_agent:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}
  if(pool) await pool.query('INSERT INTO support_tickets(id,customer_id,subject,status,ai_confidence) VALUES($1,$2,$3,$4,$5)',[ticket.id,ticket.customer_id,ticket.subject,ticket.status,ticket.ai_confidence]); else memory.supportTickets.unshift(ticket)
  await insertSupportMessage(ticket.id,'customer',user.name,message)
  await insertSupportMessage(ticket.id,'ai','Bizora Support AI',answer.reply + (answer.escalate ? (window.humanOpen?' A human agent is available now and your case is in the queue.':' Human agents are offline right now; your case is saved in the queue for the next 08:00 WAT opening.') : ''))
  return await getSupportTicket(ticket.id)
}

app.get('/api/health',(_req,res)=>res.json({ok:true,milestone:75,database:pool?'postgres':'preview-memory',support:'ai-human-handoff'}))
app.get('/api/support/status',(_req,res)=>res.json(supportWindow()))

app.post('/api/auth/register',async(req,res)=>{try{const name=String(req.body.name||'').trim(),email=String(req.body.email||'').trim().toLowerCase(),password=String(req.body.password||''),role=req.body.role==='merchant'?'merchant':'customer';if(name.length<2||!email.includes('@')||password.length<8)return res.status(400).json({error:'Use a valid name, email and password of at least 8 characters'});if(await findUserByEmail(email))return res.status(409).json({error:'An account with this email already exists'});const user=await createUser({name,email,passwordHash:await bcrypt.hash(password,12),role});res.status(201).json({token:sign(user),user:publicUser(user)})}catch(e){console.error(e);res.status(500).json({error:'Could not create account'})}})
app.post('/api/auth/login',async(req,res)=>{try{const email=String(req.body.email||'').trim().toLowerCase();const user=await findUserByEmail(email);if(!user||!(await bcrypt.compare(String(req.body.password||''),user.password_hash)))return res.status(401).json({error:'Email or password is incorrect'});res.json({token:sign(user),user:publicUser(user)})}catch(e){console.error(e);res.status(500).json({error:'Could not sign in'})}})
app.get('/api/me',auth,async(req,res)=>{let merchant=null;if(req.user.role==='merchant'){merchant=pool?(await pool.query('SELECT * FROM merchant_profiles WHERE user_id=$1 LIMIT 1',[req.user.id])).rows[0]||null:memory.merchants.find(m=>m.user_id===req.user.id)||null}res.json({user:publicUser(req.user),merchant})})

app.put('/api/merchant/profile',auth,async(req,res)=>{if(req.user.role!=='merchant')return res.status(403).json({error:'Merchant account required'});const businessName=String(req.body.businessName||'').trim(),category=String(req.body.category||'').trim(),area=String(req.body.area||'').trim(),description=String(req.body.description||'').trim();if(!businessName||!category||!area||description.length<20)return res.status(400).json({error:'Complete all merchant profile fields'});if(pool){const existing=(await pool.query('SELECT id FROM merchant_profiles WHERE user_id=$1',[req.user.id])).rows[0];const profile=existing?(await pool.query('UPDATE merchant_profiles SET business_name=$1,category=$2,area=$3,description=$4 WHERE user_id=$5 RETURNING *',[businessName,category,area,description,req.user.id])).rows[0]:(await pool.query('INSERT INTO merchant_profiles(id,user_id,business_name,category,area,description) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[id('mer'),req.user.id,businessName,category,area,description])).rows[0];return res.json({merchant:profile})}let profile=memory.merchants.find(m=>m.user_id===req.user.id);if(profile)Object.assign(profile,{business_name:businessName,category,area,description});else{profile={id:id('mer'),user_id:req.user.id,business_name:businessName,category,area,description,status:'unverified',created_at:new Date().toISOString()};memory.merchants.push(profile)}res.json({merchant:profile})})

app.post('/api/requests',auth,async(req,res)=>{if(req.user.role!=='customer')return res.status(403).json({error:'Customer account required to request a service'});const data={id:id('req'),customer_id:req.user.id,provider_slug:String(req.body.providerSlug||''),provider_name:String(req.body.providerName||''),service:String(req.body.service||''),details:String(req.body.details||'').trim(),location:String(req.body.location||'').trim(),status:'pending_quote',quote_amount:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()};if(!data.provider_slug||!data.service||data.details.length<10||!data.location)return res.status(400).json({error:'Complete the service request details'});if(pool){const r=await pool.query('INSERT INTO service_requests(id,customer_id,provider_slug,provider_name,service,details,location) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *',[data.id,data.customer_id,data.provider_slug,data.provider_name,data.service,data.details,data.location]);return res.status(201).json({request:r.rows[0]})}memory.requests.unshift(data);res.status(201).json({request:data})})
app.get('/api/requests',auth,async(req,res)=>{if(pool){const result=req.user.role==='customer'?await pool.query('SELECT * FROM service_requests WHERE customer_id=$1 ORDER BY created_at DESC',[req.user.id]):await pool.query('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 100');return res.json({requests:result.rows})}res.json({requests:req.user.role==='customer'?memory.requests.filter(r=>r.customer_id===req.user.id):memory.requests})})
app.patch('/api/requests/:requestId',auth,async(req,res)=>{const allowed=['pending_quote','quoted','accepted','in_progress','completed','cancelled'];if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid request status'});const quote=req.body.quoteAmount==null?null:Number(req.body.quoteAmount);if(pool){const current=(await pool.query('SELECT * FROM service_requests WHERE id=$1',[req.params.requestId])).rows[0];if(!current)return res.status(404).json({error:'Request not found'});if(req.user.role==='customer'&&current.customer_id!==req.user.id)return res.status(403).json({error:'Not your request'});const updated=(await pool.query('UPDATE service_requests SET status=$1,quote_amount=COALESCE($2,quote_amount),updated_at=NOW() WHERE id=$3 RETURNING *',[req.body.status,quote,req.params.requestId])).rows[0];return res.json({request:updated})}const current=memory.requests.find(r=>r.id===req.params.requestId);if(!current)return res.status(404).json({error:'Request not found'});if(req.user.role==='customer'&&current.customer_id!==req.user.id)return res.status(403).json({error:'Not your request'});current.status=req.body.status;if(quote!=null)current.quote_amount=quote;current.updated_at=new Date().toISOString();res.json({request:current})})
app.get('/api/requests/:requestId/messages',auth,async(req,res)=>{const request=pool?(await pool.query('SELECT * FROM service_requests WHERE id=$1',[req.params.requestId])).rows[0]:memory.requests.find(r=>r.id===req.params.requestId);if(!request)return res.status(404).json({error:'Request not found'});if(req.user.role==='customer'&&request.customer_id!==req.user.id)return res.status(403).json({error:'Not your request'});const rows=pool?(await pool.query('SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE request_id=$1 ORDER BY m.created_at ASC',[req.params.requestId])).rows:memory.messages.filter(m=>m.request_id===req.params.requestId);res.json({messages:rows,request})})
app.post('/api/requests/:requestId/messages',auth,async(req,res)=>{const body=String(req.body.body||'').trim();if(!body||body.length>1500)return res.status(400).json({error:'Message must be 1–1500 characters'});const request=pool?(await pool.query('SELECT * FROM service_requests WHERE id=$1',[req.params.requestId])).rows[0]:memory.requests.find(r=>r.id===req.params.requestId);if(!request)return res.status(404).json({error:'Request not found'});if(req.user.role==='customer'&&request.customer_id!==req.user.id)return res.status(403).json({error:'Not your request'});const message={id:id('msg'),request_id:req.params.requestId,sender_id:req.user.id,sender_name:req.user.name,body,created_at:new Date().toISOString()};if(pool){const row=(await pool.query('INSERT INTO messages(id,request_id,sender_id,body) VALUES($1,$2,$3,$4) RETURNING *',[message.id,message.request_id,message.sender_id,message.body])).rows[0];return res.status(201).json({message:{...row,sender_name:req.user.name}})}memory.messages.push(message);res.status(201).json({message})})
app.get('/api/merchant/stats',auth,async(req,res)=>{if(req.user.role!=='merchant')return res.status(403).json({error:'Merchant account required'});const requests=pool?(await pool.query('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 100')).rows:memory.requests;const completed=requests.filter(r=>r.status==='completed');res.json({stats:{newRequests:requests.filter(r=>r.status==='pending_quote').length,activeJobs:requests.filter(r=>['accepted','in_progress'].includes(r.status)).length,completed:completed.length,quotedValue:requests.reduce((s,r)=>s+(Number(r.quote_amount)||0),0)},requests:requests.slice(0,12)})})

app.get('/api/support/tickets',auth,async(req,res)=>{const rows=pool?(await pool.query('SELECT * FROM support_tickets WHERE customer_id=$1 ORDER BY updated_at DESC',[req.user.id])).rows:memory.supportTickets.filter(t=>t.customer_id===req.user.id).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));res.json({tickets:rows})})
app.post('/api/support/tickets',auth,async(req,res)=>{const message=String(req.body.message||'').trim();if(message.length<2||message.length>2000)return res.status(400).json({error:'Write a support message between 2 and 2000 characters'});const ticket=await createSupportTicket(req.user,message);res.status(201).json({ticket,messages:await getSupportMessages(ticket.id),support:supportWindow()})})
app.get('/api/support/tickets/:ticketId',auth,async(req,res)=>{const ticket=await getSupportTicket(req.params.ticketId);if(!ticket)return res.status(404).json({error:'Support case not found'});if(ticket.customer_id!==req.user.id)return res.status(403).json({error:'Not your support case'});res.json({ticket,messages:await getSupportMessages(ticket.id),support:supportWindow()})})
app.post('/api/support/tickets/:ticketId/messages',auth,async(req,res)=>{const ticket=await getSupportTicket(req.params.ticketId);if(!ticket)return res.status(404).json({error:'Support case not found'});if(ticket.customer_id!==req.user.id)return res.status(403).json({error:'Not your support case'});const message=String(req.body.message||'').trim();if(!message||message.length>2000)return res.status(400).json({error:'Message must be 1–2000 characters'});await insertSupportMessage(ticket.id,'customer',req.user.name,message);if(!['waiting_human','queued_off_hours','human_active'].includes(ticket.status)){const latest=await getLatestRequest(req.user.id);const answer=aiSupportAnswer(message,latest);const window=supportWindow();const newStatus=answer.escalate?(window.humanOpen?'waiting_human':'queued_off_hours'):'ai_active';await updateTicket(ticket.id,{status:newStatus,ai_confidence:answer.confidence});await insertSupportMessage(ticket.id,'ai','Bizora Support AI',answer.reply+(answer.escalate?(window.humanOpen?' Your case is now waiting for a human agent.':' Your case is queued for the next human-support opening at 08:00 WAT.') : ''))}else if(ticket.status==='human_active'){await updateTicket(ticket.id,{status:'human_active'})}else{await updateTicket(ticket.id,{status:supportWindow().humanOpen?'waiting_human':'queued_off_hours'})}res.json({ticket:await getSupportTicket(ticket.id),messages:await getSupportMessages(ticket.id),support:supportWindow()})})
app.post('/api/support/tickets/:ticketId/escalate',auth,async(req,res)=>{const ticket=await getSupportTicket(req.params.ticketId);if(!ticket)return res.status(404).json({error:'Support case not found'});if(ticket.customer_id!==req.user.id)return res.status(403).json({error:'Not your support case'});const window=supportWindow();const status=window.humanOpen?'waiting_human':'queued_off_hours';await updateTicket(ticket.id,{status});await insertSupportMessage(ticket.id,'ai','Bizora Support AI',window.humanOpen?'I’ve moved this case to the human-support queue. The agent will receive the full conversation.':'Human support is closed right now. I saved your case in the queue for the next opening at 08:00 WAT, and the agent will receive the full conversation.');res.json({ticket:await getSupportTicket(ticket.id),messages:await getSupportMessages(ticket.id),support:window})})

app.get('/api/support/agent/queue',agentAuth,async(_req,res)=>{let rows;if(pool)rows=(await pool.query("SELECT t.*,u.name AS customer_name,u.email AS customer_email FROM support_tickets t JOIN users u ON u.id=t.customer_id WHERE t.status IN ('waiting_human','queued_off_hours','human_active') ORDER BY CASE WHEN t.status='human_active' THEN 0 ELSE 1 END, t.updated_at ASC")).rows;else rows=memory.supportTickets.filter(t=>['waiting_human','queued_off_hours','human_active'].includes(t.status)).map(t=>{const u=memory.users.find(u=>u.id===t.customer_id);return {...t,customer_name:u?.name,customer_email:u?.email}});res.json({tickets:rows,support:supportWindow()})})
app.get('/api/support/agent/tickets/:ticketId',agentAuth,async(req,res)=>{const ticket=await getSupportTicket(req.params.ticketId);if(!ticket)return res.status(404).json({error:'Support case not found'});res.json({ticket,messages:await getSupportMessages(ticket.id),support:supportWindow()})})
app.post('/api/support/agent/tickets/:ticketId/reply',agentAuth,async(req,res)=>{const ticket=await getSupportTicket(req.params.ticketId);if(!ticket)return res.status(404).json({error:'Support case not found'});if(!supportWindow().humanOpen)return res.status(409).json({error:'Human-agent replies are only enabled from 08:00 to 20:00 WAT'});const message=String(req.body.message||'').trim(),agentName=String(req.body.agentName||'Bizora Human Support').trim().slice(0,80);if(!message||message.length>2000)return res.status(400).json({error:'Message must be 1–2000 characters'});await insertSupportMessage(ticket.id,'agent',agentName,message);await updateTicket(ticket.id,{status:'human_active',assigned_agent:agentName});res.json({ticket:await getSupportTicket(ticket.id),messages:await getSupportMessages(ticket.id)})})
app.post('/api/support/agent/tickets/:ticketId/resolve',agentAuth,async(req,res)=>{const ticket=await getSupportTicket(req.params.ticketId);if(!ticket)return res.status(404).json({error:'Support case not found'});await updateTicket(ticket.id,{status:'resolved'});res.json({ticket:await getSupportTicket(ticket.id)})})

app.use(express.static(path.join(__dirname,'dist')))
app.get('*',(_req,res)=>res.sendFile(path.join(__dirname,'dist','index.html')))

ensureSchema().then(()=>app.listen(PORT,'0.0.0.0',()=>console.log(`Bizora Commerce V1.75 listening on ${PORT} (${pool?'postgres':'preview-memory'})`))).catch(error=>{console.error('Startup failed',error);process.exit(1)})
