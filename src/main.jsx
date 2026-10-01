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

function Root() {
  const { pathname } = useLocation()

  if (pathname === '/support') return <SupportExperience />
  if (pathname === '/account') return <CustomerOperations />
  if (pathname === '/dashboard') return <MerchantOperations />
  if (pathname === '/marketplace') return <MarketplaceV1 />
  if (pathname.startsWith('/provider/')) return <ProviderV1 />
  if (pathname.startsWith('/request/')) return <RequestV1 />
  if (pathname === '/sell') return <MerchantProfileV1 />
  if (pathname === '/verify') return <VerificationPage />
  if (pathname === '/payments') return <PaymentsPage />
  if (pathname === '/disputes') return <DisputesPage />
  if (pathname === '/admin') return <AdminPage />

  // The 3D support robot belongs only on the public Bizora Commerce homepage.
  if (pathname === '/') return <><AppV75 /><SupportBot /></>

  return <AppV75 />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Root />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
