import React from 'react'

export default function RoleSelector({ role, onChange }) {
  return (
    <div className="d-flex gap-2 flex-wrap mb-3">
      {['marketing','gerencia','financeiro'].map(r => (
        <button
          key={r}
          className={`btn ${role===r? 'btn-primary':'btn-outline-primary'}`}
          onClick={() => onChange(r)}
        >
          {r.charAt(0).toUpperCase() + r.slice(1)}
        </button>
      ))}
    </div>
  )
}
