import React from 'react'
import ReactDOM from 'react-dom/client'
import AdminDashboard from './AdminDashboard.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AdminDashboard onLogout={() => window.location.href = '/'} />
  </React.StrictMode>,
)
