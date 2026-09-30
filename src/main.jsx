import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import AppV75 from './AppV75.jsx'
import SupportExperience from './SupportExperience.jsx'
import SupportBot from './SupportBot.jsx'
import { AdminPage, DisputesPage, PaymentsPage, VerificationPage } from './FinalExperience.jsx'
import { CustomerOperations, MerchantOperations } from './OperationsV1.jsx'
import { MarketplaceV1, MerchantProfileV1, ProviderV1 } from './MarketplaceV1.jsx'
import RequestV1 from './RequestV1.jsx'
import { AuthProvider } from './AuthContext.jsx'
import './styles75.css'
import './support.css'
import './v1-marketplace.css'

function FinalRoute({children}) {
  return <AuthProvider>{children}<SupportBot /></AuthProvider>
}

function Root() {
  const { pathname } = useLocation()
  if (pathname === '/support') return <AuthProvider><SupportExperience /></AuthProvider>
  if (pathname === '/account') return <FinalRoute><CustomerOperations /></FinalRoute>
  if (pathname === '/dashboard') return <FinalRoute><MerchantOperations /></FinalRoute>
  if (pathname === '/marketplace') return <FinalRoute><MarketplaceV1 /></FinalRoute>
  if (pathname.startsWith('/provider/')) return <FinalRoute><ProviderV1 /></FinalRoute>
  if (pathname.startsWith('/request/')) return <FinalRoute><RequestV1 /></FinalRoute>
  if (pathname === '/sell') return <FinalRoute><MerchantProfileV1 /></FinalRoute>
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
