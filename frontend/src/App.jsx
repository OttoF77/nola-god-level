import React, { Suspense, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar.jsx'
const MarketingView = React.lazy(() => import('@/views/Marketing.jsx'))
const GerenciaView = React.lazy(() => import('@/views/Gerencia.jsx'))
const FinanceiroView = React.lazy(() => import('@/views/Financeiro.jsx'))
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
        open={sidebarOpen}
        onToggle={(next) => setSidebarOpen(prev => typeof next === 'boolean' ? next : !prev)}
        role={role}
        onChangeRole={setRole}
        meta={meta}
      />

      {/* Backdrop para mobile: aparece quando o menu está aberto */}
      {sidebarOpen && (
        <div className="backdrop d-lg-none" onClick={() => setSidebarOpen(false)} aria-label="Fechar menu"></div>
      )}

      <main className={`content ${sidebarOpen ? '' : 'collapsed'}`}>
        {/* Topbar mobile com botão sanduíche */}
        <div className="topbar d-lg-none border-bottom px-2 py-2 d-flex align-items-center gap-2 mb-2">
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            aria-label="Alternar menu"
            onClick={() => setSidebarOpen(o => !o)}
          >
            <i className="bi bi-list" aria-hidden="true"></i>
          </button>
          <div className="fw-semibold">Nola Analytics</div>
        </div>

        <div className="container-fluid px-2 px-lg-3">
          {error && <div className="alert alert-danger">{error}</div>}
          {!meta && !error && <div className="alert alert-info">Carregando metadados...</div>}

          <Suspense fallback={<div className="alert alert-info">Carregando tela…</div>}>
            {role === 'marketing' && <MarketingView meta={meta} role={role} />}
            {role === 'gerencia' && <GerenciaView meta={meta} role={role} />}
            {role === 'financeiro' && <FinanceiroView meta={meta} role={role} />}
          </Suspense>

          <footer className="mt-4 border-top py-3">
            <div className="text-muted small">© {new Date().getFullYear()} Nola • Demo</div>
          </footer>
        </div>
      </main>
    </div>
  )}
