import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import botImage from './assets/support-bot.webp'
import './support-bot.css'

const messages = [
  'Need help?',
  'Support 👋',
  'I’m right here.',
  'Something wrong?',
  'Just ask me.'
]

export default function SupportBot(){
  const navigate = useNavigate()
  const [bubble, setBubble] = useState('')
  const indexRef = useRef(0)

  useEffect(()=>{
    let hideTimer
    const show = () => {
      const next = messages[indexRef.current % messages.length]
      indexRef.current += 1
      setBubble(next)
      hideTimer = window.setTimeout(()=>setBubble(''), 4200)
    }
    const first = window.setTimeout(show, 8500)
    const loop = window.setInterval(show, 22000)
    return ()=>{
      window.clearTimeout(first)
      window.clearTimeout(hideTimer)
      window.clearInterval(loop)
    }
  },[])

  return <div className="support-bot-wrap" aria-live="polite">
    {bubble && <div className="support-bot-bubble">{bubble}</div>}
    <button
      type="button"
      className="support-bot-button"
      onClick={()=>navigate('/support')}
      aria-label="Open customer support"
      title="Customer support"
    >
      <span className="support-bot-glow" aria-hidden="true"/>
      <img className="support-bot-image" src={botImage} alt="Bizora customer support bot"/>
      <span className="support-bot-label">Support</span>
    </button>
  </div>
}
