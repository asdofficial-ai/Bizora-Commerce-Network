import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, BookOpen, BriefcaseBusiness, Camera, CheckCircle2, CircleUserRound,
  CreditCard, Grid3X3, Home, Laptop, LogOut, MapPin, Megaphone, Menu,
  MessageCircle, Palette, Search, ShieldCheck, Star, Wrench, X
} from 'lucide-react'
import { useAuth } from './AuthContext.jsx'
import './home-redesign.css'

const categories = [
  { label: 'Web & App Development', icon: Laptop },
  { label: 'Design & Branding', icon: Palette },
  { label: 'Digital Marketing', icon: Megaphone },
  { label: 'Business Consulting', icon: BriefcaseBusiness },
  { label: 'Writing & Tutoring', icon: BookOpen },
  { label: 'Video & Creative', icon: Camera },
  { label: 'Home Services', icon: Home },
  { label: 'Repairs & Maintenance', icon: Wrench },
]

const featured = [
  {
    name: 'CodeCraft Kaduna',
    category: 'Web & App Development',
    area: 'Kawo, Kaduna',
    rating: 4.9,
    reviews: 76,
    image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Zainab Beauty Studio',
    category: 'Beauty & Personal Care',
    area: 'Malali, Kaduna',
    rating: 4.8,
    reviews: 129,
    image: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Abdul Tech Repairs',
    category: 'Phone & Computer Repair',
    area: 'Barnawa, Kaduna',
    rating: 4.9,
    reviews: 184,
    image: 'https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?auto=format&fit=crop&w=900&q=85',
  },
  {
    name: 'Northern Home Care',
    category: 'Home Services',
    area: 'Unguwan Rimi, Kaduna',
    rating: 4.7,
    reviews: 91,
    image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=85',
  },
]

function Logo() {
  return <Link className="hr-logo" to="/">
    <span className="hr-logo-mark">B</span>
    <span><b>Bizora</b><small>Commerce</small></span>
  </Link>
}

export default function HomeRedesign() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  function search(e) {
    e.preventDefault()
    navigate(`/marketplace?q=${encodeURIComponent(query.trim())}`)
  }

  return <div className="hr-page">
    <header className="hr-header">
      <div className="hr-shell hr-header-inner">
        <Logo />
        <nav className={menuOpen ? 'hr-nav open' : 'hr-nav'} onClick={() => setMenuOpen(false)}>
          <Link to="/">Home</Link>
          <Link to="/marketplace">Find Services</Link>
          <Link to="/how-it-works">How It Works</Link>
          <Link to="/sell">For Merchants</Link>
        </nav>
        <div className="hr-header-actions">
          {user ? <>
            <Link className="hr-account" to={user.role === 'merchant' ? '/dashboard' : '/account'}>
              <CircleUserRound size={18}/><span>{user.name?.split(' ')[0] || 'Account'}</span>
            </Link>
            <button className="hr-icon-btn" onClick={logout} aria-label="Log out"><LogOut size={18}/></button>
          </> : <Link className="hr-signin" to="/auth">Join / Sign in <ArrowRight size={16}/></Link>}
          <button className="hr-menu" onClick={() => setMenuOpen(v => !v)} aria-label="Menu">{menuOpen ? <X/> : <Menu/>}</button>
        </div>
      </div>
    </header>

    <main>
      <section className="hr-hero">
        <div className="hr-hero-overlay" />
        <div className="hr-shell hr-hero-grid">
          <div className="hr-hero-copy">
            <span className="hr-kicker">LOCAL SERVICES • VERIFIED PROVIDERS • TRUSTED WORKFLOW</span>
            <h1>Get the right service, from <em>verified providers.</em></h1>
            <p>Find trusted professionals for your home, business or personal needs. Compare, message, request work and manage everything in one place.</p>
            <div className="hr-hero-actions">
              <Link className="hr-primary" to="/marketplace">Explore Services <ArrowRight size={18}/></Link>
              <Link className="hr-secondary" to="/how-it-works">How It Works</Link>
            </div>
            <div className="hr-trust-mini">
              <span><ShieldCheck/> Verified providers</span>
              <span><CreditCard/> Structured payments</span>
              <span><MessageCircle/> Direct messaging</span>
            </div>
          </div>

          <div className="hr-hero-side">
            <div className="hr-rating-card"><b>4.8/5</b><span>★★★★★</span><small>Provider quality focus</small></div>
            <div className="hr-steps-card">
              <div><span>1</span><p><b>Post what you need</b><small>Describe the job clearly</small></p></div>
              <div><span>2</span><p><b>Get provider responses</b><small>Compare profiles and details</small></p></div>
              <div><span>3</span><p><b>Chat and agree</b><small>Keep the conversation inside Bizora</small></p></div>
              <div><span>4</span><p><b>Complete the job</b><small>Track progress from your account</small></p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="hr-shell hr-search-panel">
        <form className="hr-search" onSubmit={search}>
          <Search size={21}/>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="What service do you need?" />
          <span className="hr-location"><MapPin size={17}/> Kaduna, Nigeria</span>
          <button>Search</button>
        </form>
        <div className="hr-category-grid">
          {categories.map(({ label, icon: Icon }) => <Link to={`/marketplace?q=${encodeURIComponent(label)}`} className="hr-category" key={label}>
            <span><Icon/></span><b>{label}</b>
          </Link>)}
          <Link className="hr-category" to="/marketplace"><span><Grid3X3/></span><b>More Services</b></Link>
        </div>
      </section>

      <section className="hr-shell hr-section">
        <div className="hr-section-head">
          <div><span className="hr-kicker">DISCOVER LOCAL TALENT</span><h2>Featured providers</h2></div>
          <Link to="/marketplace">View all providers <ArrowRight size={16}/></Link>
        </div>
        <div className="hr-provider-grid">
          {featured.map(p => <Link to="/marketplace" className="hr-provider" key={p.name}>
            <div className="hr-provider-image" style={{ backgroundImage: `linear-gradient(180deg,transparent 35%,rgba(0,0,0,.82)),url(${p.image})` }}>
              <span className="hr-provider-badge"><CheckCircle2 size={14}/> Verified</span>
            </div>
            <div className="hr-provider-body">
              <h3>{p.name}</h3>
              <p>{p.category}</p>
              <div><span><Star size={14}/> {p.rating} ({p.reviews})</span><span><MapPin size={14}/> {p.area}</span></div>
            </div>
          </Link>)}
        </div>
      </section>

      <section className="hr-shell hr-stats">
        <div><strong>Focused</strong><span>local launch</span></div>
        <div><strong>Verified</strong><span>merchant workflow</span></div>
        <div><strong>Tracked</strong><span>requests & messages</span></div>
        <div><strong>Built-in</strong><span>support escalation</span></div>
      </section>

      <section className="hr-shell hr-how">
        <div className="hr-section-head">
          <div><span className="hr-kicker">HOW BIZORA WORKS</span><h2>Simple from search to completion.</h2></div>
          <Link to="/how-it-works">Full process <ArrowRight size={16}/></Link>
        </div>
        <div className="hr-how-grid">
          {[
            ['01','Search','Find the service you need.'],
            ['02','Compare','Review provider details and pricing.'],
            ['03','Connect','Message and agree on the job.'],
            ['04','Track','Follow the request through completion.'],
          ].map(([n,t,d]) => <article key={n}><span>{n}</span><h3>{t}</h3><p>{d}</p></article>)}
        </div>
      </section>
    </main>

    <footer className="hr-footer">
      <div className="hr-shell hr-footer-inner"><Logo/><span>Bizora Commerce • Inspection build</span><span>Kaduna launch focus</span></div>
    </footer>
  </div>
}
