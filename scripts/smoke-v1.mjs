const base=process.env.BASE_URL||'http://127.0.0.1:10000'
const password=process.env.SMOKE_PASSWORD
if(!password) throw new Error('SMOKE_PASSWORD is required')
async function call(path,{token,method='GET',body,headers={}}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${method} ${path} -> ${r.status}: ${JSON.stringify(data)}`);return data}
async function expectStatus(path,{token,method='GET',body,headers={}}={},status){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},body:body===undefined?undefined:JSON.stringify(body)});if(r.status!==status){const data=await r.json().catch(()=>({}));throw new Error(`Expected ${status} for ${method} ${path}, got ${r.status}: ${JSON.stringify(data)}`)}return r}
const suffix=Date.now()
const health=await call('/api/health');if(!health.ok)throw new Error('health failed')

const merchant=await call('/api/auth/register',{method:'POST',body:{name:'CI Merchant',email:`merchant-${suffix}@example.com`,password,role:'merchant'}})
const profile=await call('/api/merchant/profile',{token:merchant.token,method:'PUT',body:{businessName:`CI Tech ${suffix}`,category:'Tech & Digital',serviceName:'Website setup',startingPrice:15000,area:'Kaduna',description:'Inspection merchant used by the automated end to end Bizora Commerce test.'}})
await call('/api/verification/sandbox-complete',{token:merchant.token,method:'POST',body:{method:'BUSINESS'}})
const providers=await call('/api/providers');const listing=providers.providers.find(p=>p.provider_slug===profile.merchant.provider_slug);if(!listing)throw new Error('verified merchant missing from marketplace')

const merchant2=await call('/api/auth/register',{method:'POST',body:{name:'CI Merchant Two',email:`merchant2-${suffix}@example.com`,password,role:'merchant'}})
const profile2=await call('/api/merchant/profile',{token:merchant2.token,method:'PUT',body:{businessName:`CI Repairs ${suffix}`,category:'Phone & Computer Repair',serviceName:'Phone repair',startingPrice:9000,area:'Kaduna',description:'Second inspection merchant used to prove account and request isolation.'}})
await call('/api/verification/sandbox-complete',{token:merchant2.token,method:'POST',body:{method:'BUSINESS'}})
if(profile2.merchant.provider_slug===listing.provider_slug)throw new Error('merchant provider slugs collided')

const customer=await call('/api/auth/register',{method:'POST',body:{name:'CI Customer',email:`customer-${suffix}@example.com`,password,role:'customer'}})
await call('/api/verification/sandbox-complete',{token:customer.token,method:'POST',body:{method:'NIN'}})
const created=await call('/api/requests',{token:customer.token,method:'POST',body:{providerSlug:listing.provider_slug,providerName:listing.business_name,service:listing.service_name,details:'Please build a simple inspection website for my small business.',location:'Kaduna'}})
const rid=created.request.id

const merchantQueue=await call('/api/requests',{token:merchant.token});if(!merchantQueue.requests.some(r=>r.id===rid))throw new Error('merchant did not receive own request')
const merchant2Queue=await call('/api/requests',{token:merchant2.token});if(merchant2Queue.requests.some(r=>r.id===rid))throw new Error('second merchant can see another merchant request')
await expectStatus(`/api/requests/${rid}/messages`,{token:merchant2.token},403)
await expectStatus(`/api/requests/${rid}`,{token:merchant2.token,method:'PATCH',body:{status:'quoted',quoteAmount:999}},403)

const customer2=await call('/api/auth/register',{method:'POST',body:{name:'CI Customer Two',email:`customer2-${suffix}@example.com`,password,role:'customer'}})
await expectStatus(`/api/requests/${rid}`,{token:customer2.token},403)
await expectStatus(`/api/requests/${rid}/messages`,{token:customer2.token},403)
await expectStatus(`/api/requests/${rid}`,{token:customer.token,method:'PATCH',body:{status:'quoted',quoteAmount:15000}},400)

await call(`/api/requests/${rid}`,{token:merchant.token,method:'PATCH',body:{status:'quoted',quoteAmount:15000}})
await call(`/api/requests/${rid}/messages`,{token:customer.token,method:'POST',body:{body:'Thanks. Is the quote final?'}})
const thread=await call(`/api/requests/${rid}/messages`,{token:merchant.token});if(!thread.messages.length)throw new Error('request messaging failed')
await call(`/api/requests/${rid}`,{token:customer.token,method:'PATCH',body:{status:'accepted'}})

const payment=await call('/api/payments',{token:customer.token,method:'POST',body:{requestId:rid,amount:15000}});if(payment.payment.status!=='held')throw new Error('escrow was not held')
await call(`/api/requests/${rid}`,{token:merchant.token,method:'PATCH',body:{status:'in_progress'}})
await call(`/api/requests/${rid}`,{token:merchant.token,method:'PATCH',body:{status:'completed'}})
const completed=await call(`/api/requests/${rid}`,{token:customer.token});if(completed.request.status!=='completed')throw new Error('job did not reach completed status')
const released=await call(`/api/payments/${payment.payment.id}/release`,{token:customer.token,method:'POST'});if(released.payment.status!=='released')throw new Error('escrow release failed')
await call('/api/disputes',{token:customer.token,method:'POST',body:{paymentId:payment.payment.id,reason:'Automated inspection dispute used to verify the resolution workflow.'}})
const support=await call('/api/support/tickets',{token:customer.token,method:'POST',body:{message:'I want to speak with a human support agent.'}});if(!support.ticket?.id)throw new Error('support ticket failed')
console.log('BIZORA_V1_SMOKE_OK',{provider:listing.provider_slug,isolatedFrom:profile2.merchant.provider_slug,request:rid,payment:payment.payment.id,support:support.ticket.id})
