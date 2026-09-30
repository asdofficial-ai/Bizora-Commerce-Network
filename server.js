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
const __dirname = path.dirname(fileURLToPath(import.meta.url))

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: true, credentials: true }))
app.use(express.json({ limit: '1mb' }))

const usePostgres = Boolean(process.env.DATABASE_URL)
const pool = usePostgres ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false }) : null

const memory = {
  users: [],
  merchants: [],
  requests: [],
  messages: [],
}

function id(prefix) { return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 18)}` }
function publicUser(user) { return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.created_at || user.createdAt } }
function sign(user) { return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' }) }

async function ensureSchema() {
  if (!pool) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('customer','merchant')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS merchant_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_name TEXT NOT NULL,
      category TEXT NOT NULL,
      area TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'unverified',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS service_requests (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider_slug TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      service TEXT NOT NULL,
      details TEXT NOT NULL,
      location TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending_quote',
      quote_amount INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_requests_customer ON service_requests(customer_id);
    CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id);
  `)
}

async function findUserByEmail(email) {
  if (pool) return (await pool.query('SELECT * FROM users WHERE email=$1 LIMIT 1', [email])).rows[0]
  return memory.users.find(u => u.email === email)
}
async function findUserById(userId) {
  if (pool) return (await pool.query('SELECT * FROM users WHERE id=$1 LIMIT 1', [userId])).rows[0]
  return memory.users.find(u => u.id === userId)
}
async function createUser({ name, email, passwordHash, role }) {
  const user = { id: id('usr'), name, email, password_hash: passwordHash, role, created_at: new Date().toISOString() }
  if (pool) return (await pool.query('INSERT INTO users(id,name,email,password_hash,role) VALUES($1,$2,$3,$4,$5) RETURNING *', [user.id,name,email,passwordHash,role])).rows[0]
  memory.users.push(user); return user
}

async function auth(req, res, next) {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await findUserById(payload.sub)
    if (!user) return res.status(401).json({ error: 'Account no longer exists' })
    req.user = user
    next()
  } catch { return res.status(401).json({ error: 'Invalid or expired session' }) }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, milestone: 75, database: pool ? 'postgres' : 'preview-memory' }))

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const role = req.body.role === 'merchant' ? 'merchant' : 'customer'
    if (name.length < 2 || !email.includes('@') || password.length < 8) return res.status(400).json({ error: 'Use a valid name, email and password of at least 8 characters' })
    if (await findUserByEmail(email)) return res.status(409).json({ error: 'An account with this email already exists' })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = await createUser({ name, email, passwordHash, role })
    res.status(201).json({ token: sign(user), user: publicUser(user) })
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not create account' }) }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    const user = await findUserByEmail(email)
    if (!user || !(await bcrypt.compare(String(req.body.password || ''), user.password_hash))) return res.status(401).json({ error: 'Email or password is incorrect' })
    res.json({ token: sign(user), user: publicUser(user) })
  } catch (error) { console.error(error); res.status(500).json({ error: 'Could not sign in' }) }
})

app.get('/api/me', auth, async (req, res) => {
  let merchant = null
  if (req.user.role === 'merchant') {
    if (pool) merchant = (await pool.query('SELECT * FROM merchant_profiles WHERE user_id=$1 LIMIT 1', [req.user.id])).rows[0] || null
    else merchant = memory.merchants.find(m => m.user_id === req.user.id) || null
  }
  res.json({ user: publicUser(req.user), merchant })
})

app.put('/api/merchant/profile', auth, async (req, res) => {
  if (req.user.role !== 'merchant') return res.status(403).json({ error: 'Merchant account required' })
  const businessName = String(req.body.businessName || '').trim()
  const category = String(req.body.category || '').trim()
  const area = String(req.body.area || '').trim()
  const description = String(req.body.description || '').trim()
  if (!businessName || !category || !area || description.length < 20) return res.status(400).json({ error: 'Complete all merchant profile fields' })
  if (pool) {
    const existing = (await pool.query('SELECT id FROM merchant_profiles WHERE user_id=$1', [req.user.id])).rows[0]
    const profile = existing
      ? (await pool.query('UPDATE merchant_profiles SET business_name=$1,category=$2,area=$3,description=$4 WHERE user_id=$5 RETURNING *', [businessName,category,area,description,req.user.id])).rows[0]
      : (await pool.query('INSERT INTO merchant_profiles(id,user_id,business_name,category,area,description) VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [id('mer'),req.user.id,businessName,category,area,description])).rows[0]
    return res.json({ merchant: profile })
  }
  let profile = memory.merchants.find(m => m.user_id === req.user.id)
  if (profile) Object.assign(profile, { business_name:businessName, category, area, description })
  else { profile = { id:id('mer'), user_id:req.user.id, business_name:businessName, category, area, description, status:'unverified', created_at:new Date().toISOString() }; memory.merchants.push(profile) }
  res.json({ merchant: profile })
})

app.post('/api/requests', auth, async (req, res) => {
  if (req.user.role !== 'customer') return res.status(403).json({ error: 'Customer account required to request a service' })
  const data = {
    id: id('req'), customer_id:req.user.id,
    provider_slug:String(req.body.providerSlug || ''), provider_name:String(req.body.providerName || ''),
    service:String(req.body.service || ''), details:String(req.body.details || '').trim(), location:String(req.body.location || '').trim(),
    status:'pending_quote', quote_amount:null, created_at:new Date().toISOString(), updated_at:new Date().toISOString()
  }
  if (!data.provider_slug || !data.service || data.details.length < 10 || !data.location) return res.status(400).json({ error: 'Complete the service request details' })
  if (pool) {
    const r = await pool.query('INSERT INTO service_requests(id,customer_id,provider_slug,provider_name,service,details,location) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [data.id,data.customer_id,data.provider_slug,data.provider_name,data.service,data.details,data.location])
    return res.status(201).json({ request:r.rows[0] })
  }
  memory.requests.unshift(data); res.status(201).json({ request:data })
})

app.get('/api/requests', auth, async (req, res) => {
  if (pool) {
    const result = req.user.role === 'customer'
      ? await pool.query('SELECT * FROM service_requests WHERE customer_id=$1 ORDER BY created_at DESC', [req.user.id])
      : await pool.query('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 100')
    return res.json({ requests:result.rows })
  }
  const rows = req.user.role === 'customer' ? memory.requests.filter(r => r.customer_id === req.user.id) : memory.requests
  res.json({ requests:rows })
})

app.patch('/api/requests/:requestId', auth, async (req, res) => {
  const allowed = ['pending_quote','quoted','accepted','in_progress','completed','cancelled']
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error:'Invalid request status' })
  const quote = req.body.quoteAmount == null ? null : Number(req.body.quoteAmount)
  if (pool) {
    const current = (await pool.query('SELECT * FROM service_requests WHERE id=$1', [req.params.requestId])).rows[0]
    if (!current) return res.status(404).json({ error:'Request not found' })
    if (req.user.role === 'customer' && current.customer_id !== req.user.id) return res.status(403).json({ error:'Not your request' })
    const updated = (await pool.query('UPDATE service_requests SET status=$1,quote_amount=COALESCE($2,quote_amount),updated_at=NOW() WHERE id=$3 RETURNING *', [req.body.status,quote,req.params.requestId])).rows[0]
    return res.json({ request:updated })
  }
  const current = memory.requests.find(r => r.id === req.params.requestId)
  if (!current) return res.status(404).json({ error:'Request not found' })
  if (req.user.role === 'customer' && current.customer_id !== req.user.id) return res.status(403).json({ error:'Not your request' })
  current.status = req.body.status; if (quote != null) current.quote_amount = quote; current.updated_at = new Date().toISOString()
  res.json({ request:current })
})

app.get('/api/requests/:requestId/messages', auth, async (req, res) => {
  let request
  if (pool) request = (await pool.query('SELECT * FROM service_requests WHERE id=$1', [req.params.requestId])).rows[0]
  else request = memory.requests.find(r => r.id === req.params.requestId)
  if (!request) return res.status(404).json({ error:'Request not found' })
  if (req.user.role === 'customer' && request.customer_id !== req.user.id) return res.status(403).json({ error:'Not your request' })
  const rows = pool ? (await pool.query('SELECT m.*,u.name AS sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE request_id=$1 ORDER BY m.created_at ASC', [req.params.requestId])).rows : memory.messages.filter(m => m.request_id === req.params.requestId)
  res.json({ messages:rows, request })
})

app.post('/api/requests/:requestId/messages', auth, async (req, res) => {
  const body = String(req.body.body || '').trim()
  if (!body || body.length > 1500) return res.status(400).json({ error:'Message must be 1–1500 characters' })
  let request
  if (pool) request = (await pool.query('SELECT * FROM service_requests WHERE id=$1', [req.params.requestId])).rows[0]
  else request = memory.requests.find(r => r.id === req.params.requestId)
  if (!request) return res.status(404).json({ error:'Request not found' })
  if (req.user.role === 'customer' && request.customer_id !== req.user.id) return res.status(403).json({ error:'Not your request' })
  const message = { id:id('msg'), request_id:req.params.requestId, sender_id:req.user.id, sender_name:req.user.name, body, created_at:new Date().toISOString() }
  if (pool) {
    const row = (await pool.query('INSERT INTO messages(id,request_id,sender_id,body) VALUES($1,$2,$3,$4) RETURNING *', [message.id,message.request_id,message.sender_id,message.body])).rows[0]
    return res.status(201).json({ message:{...row,sender_name:req.user.name} })
  }
  memory.messages.push(message); res.status(201).json({ message })
})

app.get('/api/merchant/stats', auth, async (req, res) => {
  if (req.user.role !== 'merchant') return res.status(403).json({ error:'Merchant account required' })
  const requests = pool ? (await pool.query('SELECT * FROM service_requests ORDER BY created_at DESC LIMIT 100')).rows : memory.requests
  const completed = requests.filter(r => r.status === 'completed')
  res.json({ stats:{ newRequests:requests.filter(r => r.status === 'pending_quote').length, activeJobs:requests.filter(r => ['accepted','in_progress'].includes(r.status)).length, completed:completed.length, quotedValue:requests.reduce((s,r)=>s+(Number(r.quote_amount)||0),0) }, requests:requests.slice(0,12) })
})

app.use(express.static(path.join(__dirname, 'dist')))
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'dist', 'index.html')))

ensureSchema().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Bizora Commerce V1 API listening on ${PORT} (${pool ? 'postgres' : 'preview-memory'})`))).catch(error => { console.error('Startup failed', error); process.exit(1) })
