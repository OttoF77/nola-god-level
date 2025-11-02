import React from 'react'
import ExplorerControls from '@/components/ExplorerControls.jsx'

export default function Sidebar({ open, onToggle, role, onChangeRole, meta }) {
  return (
    <aside className={`sidebar d-flex flex-column ${open ? 'open' : 'collapsed'}`}>
      <div className="d-flex align-items-center gap-2 p-2 border-bottom">
        <div className="fw-semibold">Nola</div>
      </div>
      <nav className="mt-2">
        <ul className="nav flex-column">
          <li className="nav-item">
            <button
              className={`nav-link w-100 text-start ${role === 'marketing' ? 'active' : ''}`}
              onClick={() => onChangeRole && onChangeRole('marketing')}
              title="Marketing"
            >
              <i className="bi bi-megaphone" aria-hidden="true"></i>
              <span className="nav-label">Marketing</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link w-100 text-start ${role === 'gerencia' ? 'active' : ''}`}
              onClick={() => onChangeRole && onChangeRole('gerencia')}
              title="Gerência"
            >
              <i className="bi bi-graph-up" aria-hidden="true"></i>
              <span className="nav-label">Gerência</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link w-100 text-start ${role === 'financeiro' ? 'active' : ''}`}
              onClick={() => onChangeRole && onChangeRole('financeiro')}
              title="Financeiro"
            >
              <i className="bi bi-cash-coin" aria-hidden="true"></i>
              <span className="nav-label">Financeiro</span>
            </button>
          </li>
        </ul>
      </nav>
      <div className="p-2 border-top">
        <ExplorerControls role={role} meta={meta} />
      </div>
      <div className="mt-auto p-2 text-muted small">
        <div>© {new Date().getFullYear()} Nola</div>
      </div>
    </aside>
  )
}
