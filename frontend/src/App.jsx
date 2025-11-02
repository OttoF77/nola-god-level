import React, { useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar.jsx'
import MarketingView from '@/views/Marketing.jsx'
import GerenciaView from '@/views/Gerencia.jsx'
import FinanceiroView from '@/views/Financeiro.jsx'
import { getMetadata } from '@/api.js'

export default function App() {
  const [role, setRole] = useState(localStorage.getItem('role') || 'marketing')
  const [meta, setMeta] = useState(null)
  const [error, setError] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebar_open')
    return saved !== null ? saved === 'true' : true
  })

  useEffect(() => {
    localStorage.setItem('role', role)
  }, [role])

  useEffect(() => {
    getMetadata().then(setMeta).catch(e=> setError(String(e.message||e)))
  }, [])

  useEffect(() => {
    localStorage.setItem('sidebar_open', String(sidebarOpen))
  }, [sidebarOpen])

  return (
    <div className="app-shell">
      <Sidebar
        open={true}
        onToggle={() => {}}
        role={role}
        onChangeRole={setRole}
        meta={meta}
      />

  {/* Backdrop removido pois o menu não é mais colapsável */}

      <main className={`content`}>
        {/* Topbar mobile sem botão sanduíche */}
        <div className="topbar d-lg-none border-bottom px-2 py-2 d-flex align-items-center gap-2 mb-2">
          <div className="fw-semibold">Nola Analytics</div>
        </div>

        <div className="container-fluid px-2 px-lg-3">
          {error && <div className="alert alert-danger">{error}</div>}
          {!meta && !error && <div className="alert alert-info">Carregando metadados...</div>}

          {role === 'marketing' && <MarketingView meta={meta} role={role} />}
          {role === 'gerencia' && <GerenciaView meta={meta} role={role} />}
          {role === 'financeiro' && <FinanceiroView meta={meta} role={role} />}

          <footer className="mt-4 border-top py-3">
            <div className="text-muted small">© {new Date().getFullYear()} Nola • Demo</div>
          </footer>
        </div>
      </main>
    </div>
  )}
