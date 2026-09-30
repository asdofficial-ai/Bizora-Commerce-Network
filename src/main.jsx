import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import AppV75 from './AppV75.jsx'
import './styles75.css'
import './support.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppV75 />
    </BrowserRouter>
  </React.StrictMode>,
)
