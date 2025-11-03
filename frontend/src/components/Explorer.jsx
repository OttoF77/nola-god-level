// Explorer: exibe resultados da última execução do painel lateral (ExplorerControls)
// - Mostra colunas com nomes amigáveis e valores formatados/alinhados
// - Oferece exportação CSV com o mesmo conjunto de colunas
import React, { useEffect, useState } from 'react'

// Mapeamento de nomes técnicos para nomes amigáveis
const friendlyNames = {
  'sales.total_amount': 'Vendas (Acumulado)',
  'sales.orders': 'Pedidos',
  'sales.ticket_medio': 'Ticket Médio',
  'sales.discount': 'Descontos',
  'sales.delivery_fee': 'Taxa de Entrega',
  'sales.service_fee': 'Taxa de Serviço',
  'sales.increase': 'Acréscimos',
  'products.quantity': 'Quantidade',
  'products.revenue': 'Receita',
  'payments.amount': 'Valor de Pagamentos',
  'payments.count': 'Contagem de Pagamentos',
  'time.date': 'Data',
  'store.name': 'Filial',
  'channel.name': 'Canal',
  'product.name': 'Produto',
  'sales.status': 'Status da Venda',
  'payment.type': 'Tipo de Pagamento',
  'payment.online': 'Pagamento Online',
}

// Tradução de valores de status
const statusTranslations = {
  'COMPLETED': 'Entregue',
  'CANCELLED': 'Cancelado',
}

function getFriendlyName(technicalName) {
  return friendlyNames[technicalName] || technicalName
}

function translateValue(columnName, value) {
  // Traduz valores de status
  if (columnName === 'sales.status' && typeof value === 'string') {
    return statusTranslations[value] || value
  }
  return value
}

export default function Explorer({ role }) {
  const [result, setResult] = useState({ rows: [], columns: [] })
  const [error, setError] = useState('')

  const columns = result.columns?.length ? result.columns : (result.rows?.[0] ? Object.keys(result.rows[0]) : [])

  function toCSV() {
    const cols = columns
    const esc = (v) => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      const needsQuote = /[",\n;]/.test(s)
      const q = s.replace(/"/g, '""')
      return needsQuote ? `"${q}"` : q
    }
    const header = cols.map(esc).join(',')
    const lines = result.rows.map(r => cols.map(c => esc(r[c])).join(','))
    return [header, ...lines].join('\n')
  }

  function exportCSV() {
    try {
      const csv = toCSV()
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-')
      a.download = `explorer-${role}-${stamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {}
  }

  // load initial result from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(`explorer:${role}:result`)
      if (raw) {
        const json = JSON.parse(raw)
        if (json && json.rows && json.columns) setResult(json)
      }
    } catch {}
  }, [role])

  // listen for updates from controls
  useEffect(() => {
    function onUpdated(ev) {
      if (ev?.detail?.role && ev.detail.role !== role) return
      try {
        const raw = localStorage.getItem(`explorer:${role}:result`)
        if (!raw) return
        const json = JSON.parse(raw)
        if (json && json.rows && json.columns) setResult(json)
      } catch {}
    }
    window.addEventListener('explorer-updated', onUpdated)
    return () => window.removeEventListener('explorer-updated', onUpdated)
  }, [role])

  return (
    <div className="card mb-4">
      <div className="card-header d-flex align-items-center justify-content-between">
        <div className="fw-semibold">Análise livre (resultados)</div>
        <div className="text-muted small">Resultados da última execução</div>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-danger mt-0 mb-3">{error}</div>}
        <div className="d-flex justify-content-end mb-2">
          <button className="btn btn-outline-secondary btn-sm" onClick={exportCSV} disabled={!result.rows.length}>Exportar CSV</button>
        </div>
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle">
            <thead className="table-light">
              <tr>
                {columns.map(c => {
                  // Verifica se a coluna contém valores numéricos no primeiro resultado
                  const isNumeric = result.rows.length > 0 && typeof result.rows[0][c] === 'number'
                  return (
                    <th key={c} className={isNumeric ? 'text-end' : ''}>
                      {getFriendlyName(c)}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((r,idx)=> (
                <tr key={idx}>
                  {columns.map(c => {
                    let value = r[c]
                    // Traduz valores específicos (como status)
                    value = translateValue(c, value)
                    const isNumber = typeof value === 'number'
                    // Formata valores monetários (amount, total_amount, revenue, etc)
                    const isCurrency = isNumber && (
                      c.includes('amount') || 
                      c.includes('revenue') || 
                      c.includes('discount') || 
                      c.includes('fee') || 
                      c.includes('increase')
                    )
                    let displayValue = value
                    if (isCurrency) {
                      displayValue = Number(value).toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })
                    } else if (isNumber) {
                      displayValue = Number(value).toLocaleString('pt-BR')
                    } else {
                      displayValue = String(value)
                    }
                    return (
                      <td key={c} className={(isNumber ? 'text-end ' : '') + 'text-break'}>
                        {displayValue}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {!result.rows.length && (
                <tr><td colSpan={columns.length || 1} className="text-muted text-center">Sem resultados</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
