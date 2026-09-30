import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import AppV75 from './AppV75.jsx'
import SupportExperience from './SupportExperience.jsx'
import SupportBot from './SupportBot.jsx'
import { AdminPage, CustomerHub, DisputesPage, MerchantHub, PaymentsPage, VerificationPage } from './FinalExperience.jsx'
import { AuthProvider } from './AuthContext.jsx'
import './styles75.css'
import './support.css'

function FinalRoute({children}) {
  return <AuthProvider>{children}<SupportBot /></AuthProvider>
}

function Root() {
  const { pathname } = useLocation()
  if (pathname === '/support') return <AuthProvider><SupportExperience /></AuthProvider>
  if (pathname === '/account') return <FinalRoute><CustomerHub /></FinalRoute>
  if (pathname === '/dashboard') return <FinalRoute><MerchantHub /></FinalRoute>
  if (pathname === '/verify') return <FinalRoute><VerificationPage /></FinalRoute>
  if (pathname === '/payments') return <FinalRoute><PaymentsPage /></FinalRoute>
  if (pathname === '/disputes') return <FinalRoute><DisputesPage /></FinalRoute>
  if (pathname === '/admin') return <AuthProvider><AdminPage /></AuthProvider>
  return <>
    <AppV75 />
    <SupportBot />
  </>
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
)
