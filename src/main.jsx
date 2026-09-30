import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import AppV75 from './AppV75.jsx'
import SupportExperience from './SupportExperience.jsx'
import SupportBot from './SupportBot.jsx'
import { AuthProvider } from './AuthContext.jsx'
import './styles75.css'
import './support.css'

function Root() {
  const { pathname } = useLocation()
  if (pathname === '/support') {
    return <AuthProvider><SupportExperience /></AuthProvider>
  }
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
