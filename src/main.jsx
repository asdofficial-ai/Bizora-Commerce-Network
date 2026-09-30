import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App75 from './App75.jsx'
import './styles75.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App75 />
    </BrowserRouter>
  </React.StrictMode>,
)
