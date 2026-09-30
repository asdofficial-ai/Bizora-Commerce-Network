import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Bot, Headphones, Send, ShieldCheck, UserRound, ArrowLeft, LogOut, Clock3 } from 'lucide-react'
import { api } from './api.js'
import { useAuth } from './AuthContext.jsx'
import './support-clean.css'

function statusLabel(status) {
  return String(status || 'ai_active').replaceAll('_', ' ')
}

export default function SupportExperience() {
  const { user, token, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState(null)
  const [messages, setMessages] = useState([])
  const [support, setSupport] = useState(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [initializing, setInitializing] = useState(true)

  async function refreshStatus() {
    try { setSupport(await api('/api/support/status')) } catch {}
  }

  async function loadConversation() {
    if (!token) {
      setTicket(null)
      setMessages([])
      setInitializing(false)
      return
    }
    try {
      const list = await api('/api/support/tickets', {}, token)
      const latest = list.tickets?.[0]
      if (!latest) {
        setTicket(null)
        setMessages([])
        return
      }
      const thread = await api(`/api/support/tickets/${latest.id}`, {}, token)
      setTicket(thread.ticket)
      setMessages(thread.messages || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setInitializing(false)
    }
  }

  useEffect(() => {
    refreshStatus()
    loadConversation()
  }, [token])

  async function deliver(message) {
    const body = String(message || '').trim()
    if (!body || busy) return
    if (!user) {
      setError('Sign in first so Bizora can safely connect the support conversation to your account.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let data
      if (ticket) {
        data = await api(`/api/support/tickets/${ticket.id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ message: body }),
        }, token)
      } else {
        data = await api('/api/support/tickets', {
          method: 'POST',
          body: JSON.stringify({ message: body }),
        }, token)
      }
      setTicket(data.ticket)
      setMessages(data.messages || [])
      setText('')
      if (data.support) setSupport(data.support)
      else refreshStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function send(e) {
    e.preventDefault()
    await deliver(text)
  }

  async function requestHuman() {
    if (busy) return
    if (!user) {
      setError('Sign in first so a human agent can receive your account and conversation context.')
      return
    }
    setBusy(true)
    setError('')
    try {
      let current = ticket
      let currentMessages = messages
      if (!current) {
        const created = await api('/api/support/tickets', {
          method: 'POST',
          body: JSON.stringify({ message: 'I need help from a human support agent.' }),
        }, token)
        current = created.ticket
        currentMessages = created.messages || []
      }
      const escalated = await api(`/api/support/tickets/${current.id}/escalate`, { method: 'POST' }, token)
      setTicket(escalated.ticket)
      setMessages(escalated.messages || currentMessages)
      if (escalated.support) setSupport(escalated.support)
      else refreshStatus()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const quickActions = [
    'Track my request',
    'I need account help',
    'How do bookings work?',
  ]

  return <div className="clean-support-page">
    <header className="clean-support-header">
      <div className="clean-support-shell clean-support-header-inner">
        <Link className="clean-support-brand" to="/">
          <span className="clean-support-logo">B</span>
          <span>Bizora <b>Commerce</b></span>
        </Link>
        <div className="clean-support-header-actions">
          <span className="clean-availability"><span className="clean-dot"/>AI 24/7</span>
          <span className="clean-availability desktop-only"><Clock3 size={15}/>Human 08:00–20:00 WAT</span>
          {user ? <>
            <Link className="clean-account-link" to={user.role === 'merchant' ? '/dashboard' : '/account'}><UserRound size={17}/>{user.name.split(' ')[0]}</Link>
            <button className="clean-icon-button" onClick={() => { logout(); navigate('/') }} aria-label="Log out"><LogOut size={18}/></button>
          </> : <Link className="clean-login" to="/auth">Sign in</Link>}
        </div>
      </div>
    </header>

    <main className="clean-support-main">
      <div className="clean-support-shell clean-chat-card">
        <div className="clean-chat-head">
          <div className="clean-chat-title">
            <Link className="clean-back" to="/"><ArrowLeft size={18}/></Link>
            <div className="clean-ai-avatar"><Bot size={24}/></div>
            <div>
              <span className="clean-kicker">BIZORA SUPPORT</span>
              <h1>{ticket && ['waiting_human','queued_off_hours','human_active'].includes(ticket.status) ? 'Customer support' : 'Bizora Support AI'}</h1>
              <p>{ticket ? `Conversation ${ticket.id}` : 'One support conversation. Continue where you left off.'}</p>
            </div>
          </div>
          <div className="clean-chat-statuses">
            {ticket && <span className="clean-ticket-status">{statusLabel(ticket.status)}</span>}
            <button className="clean-human-button" onClick={requestHuman} disabled={busy || loading}>
              <Headphones size={17}/> Talk to a human
            </button>
          </div>
        </div>

        <div className="clean-chat-body">
          {initializing ? <div className="clean-loading">Loading your conversation…</div> : messages.length === 0 ? <div className="clean-welcome">
            <div className="clean-welcome-icon"><Bot size={32}/></div>
            <h2>Hi{user ? ` ${user.name.split(' ')[0]}` : ''}. What do you need help with?</h2>
            <p>Bizora AI will try to solve it first. If the issue needs a person, the full conversation is handed to a human agent automatically.</p>
            {!user && <button className="clean-signin-cta" onClick={() => navigate('/auth')}>Sign in to start support</button>}
            {user && <div className="clean-quick-actions">
              {quickActions.map(action => <button key={action} onClick={() => deliver(action)} disabled={busy}>{action}</button>)}
            </div>}
          </div> : <div className="clean-message-stack">
            {messages.map(message => <div key={message.id} className={`clean-message ${message.sender_type}`}>
              <div className="clean-message-meta">
                <b>{message.sender_name}</b>
                <span>{new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p>{message.body}</p>
            </div>)}
          </div>}
        </div>

        <div className="clean-compose-area">
          {user && messages.length > 0 && <div className="clean-inline-actions">
            <button onClick={() => deliver('Track my request')} disabled={busy}>Track my request</button>
            <button onClick={requestHuman} disabled={busy}>Human agent</button>
          </div>}
          <form className="clean-compose" onSubmit={send}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={user ? 'Message Bizora Support…' : 'Sign in to use customer support'}
              disabled={!user || busy}
            />
            <button type="submit" disabled={!user || busy || !text.trim()} aria-label="Send message"><Send size={20}/></button>
          </form>
          {error && <div className="clean-error">{error}</div>}
          <div className="clean-support-note"><ShieldCheck size={14}/><span>AI is available 24/7. Human agents work 08:00–20:00 WAT. Off-hours escalations stay safely queued.</span></div>
        </div>
      </div>
    </main>
  </div>
}
