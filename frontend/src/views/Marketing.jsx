// View: Marketing — gráficos e indicadores voltados para receita e canais
// - Controla período (hoje/mês/personalizado) com sincronização via localStorage
// - Exibe faturamento por canal (linha) e Top 10 produtos (barras)
// - Integra com o Explorer para análise livre
import React, { useEffect, useMemo, useState } from 'react'
import { runQuery, getDataRange } from '@/api'
import { todayStrLocal, monthStartLocal } from '@/lib/date'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, BarChart, Bar } from 'recharts'
import Explorer from '@/components/Explorer'

function SummaryCard({ title, value, subtitle }) {
  return (
    <div className="col">
      <div className="card shadow-sm">
        <div className="card-body">
          <div className="fw-semibold text-secondary">{title}</div>
          <div className="fs-3 fw-bold">{value}</div>
          {subtitle && <div className="text-muted small">{subtitle}</div>}
        </div>
      </div>
    </div>
  )
}

export default function MarketingView({ meta, role }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [overviewRows, setOverviewRows] = useState([])
  const [topProducts, setTopProducts] = useState([])
  const [channels, setChannels] = useState([])

  // Controle de período interativo
  const today = useMemo(() => todayStrLocal(), [])
  const [rangeType, setRangeType] = useState('today') // 'today' | 'month' | 'custom'
  const [dateStart, setDateStart] = useState(today)
  const [dateEnd, setDateEnd] = useState(today)
  const [limits, setLimits] = useState({ sales: {min:null, max:null}, products: {min:null, max:null} })

  useEffect(() => {
    // Carrega limites de datas disponíveis para melhorar UX (opcional)
    async function loadLimits() {
      try {
        const [s, p] = await Promise.all([getDataRange('sales'), getDataRange('products')])
        setLimits({
          sales: { min: s.min_date || null, max: s.max_date || null },
          products: { min: p.min_date || null, max: p.max_date || null },
        })
      } catch {}
    }
    loadLimits()
  }, [])

  // Sincroniza período via localStorage (compartilhado entre views)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ui:period')
      if (raw) {
        const p = JSON.parse(raw)
        if (p && p.rangeType) setRangeType(p.rangeType)
        if (p && p.dateStart) setDateStart(p.dateStart)
        if (p && p.dateEnd) setDateEnd(p.dateEnd)
      }
    } catch {}
  }, [])


  const currentRange = useMemo(() => {
    if (rangeType === 'today') return [today, today]
    if (rangeType === 'month') return [monthStartLocal(), today]
    return [dateStart, dateEnd]
  }, [rangeType, dateStart, dateEnd, today])

  // Persistir e notificar mudanças de período (para two-way completo)
  useEffect(() => {
    try {
      localStorage.setItem('ui:period', JSON.stringify({ rangeType, dateStart, dateEnd }))
      window.dispatchEvent(new CustomEvent('ui-period-updated', { detail: { rangeType, dateStart, dateEnd } }))
    } catch {}
  }, [rangeType, dateStart, dateEnd])

  // Ouvir atualizações vindas do Explorer (two-way sync)
  useEffect(() => {
    function onUpdated(ev) {
      const p = ev?.detail
      if (!p || !p.dateStart || !p.dateEnd) return
      // evita loops se nada mudou
      if (rangeType === 'custom' && dateStart === p.dateStart && dateEnd === p.dateEnd) return
      setRangeType('custom')
      setDateStart(p.dateStart)
      setDateEnd(p.dateEnd)
    }
    window.addEventListener('ui-period-updated', onUpdated)
    return () => window.removeEventListener('ui-period-updated', onUpdated)
  }, [rangeType, dateStart, dateEnd])

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError('')
      try {
        // Overview diário (faturamento, pedidos, ticket) do mês
        const ov = await runQuery({
          role: 'marketing',
          cube: 'sales',
          measures: ['sales.total_amount','sales.orders','sales.ticket_medio'],
          dimensions: ['time.date','channel.name'],
          filters: [
            { dimension: 'sales.status', op: 'equals', values: ['COMPLETED'] },
            { dimension: 'time.date', op: 'between', values: currentRange }
          ],
          granularity: 'day',
          order: [{ by: 'sales.total_amount', dir: 'desc' }],
          limit: 1000
        })
  setOverviewRows(ov.rows || [])
  // captura canais únicos para cores/linhas
  const chset = new Set((ov.rows||[]).map(r => r['channel.name']).filter(Boolean))
  setChannels(Array.from(chset))

        // Top 10 produtos do mês por receita
        const tp = await runQuery({
          role: 'marketing',
          cube: 'products',
          measures: ['products.revenue','products.quantity'],
          dimensions: ['product.name','store.name','channel.name','time.date'],
          filters: [
            { dimension: 'time.date', op: 'between', values: currentRange }
          ],
          granularity: 'day',
          order: [{ by: 'products.revenue', dir: 'desc' }],
          limit: 10
        })
        setTopProducts(tp.rows || [])
      } catch (e) {
        setError(String(e.message || e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentRange])

  // Resumos agregados
  const totals = useMemo(() => {
    const sum = (k) => overviewRows.reduce((acc,r)=>acc+(Number(r[k])||0),0)
    return {
      amount: sum('sales.total_amount'),
      orders: sum('sales.orders'),
      ticket: (sum('sales.total_amount') / (sum('sales.orders')||1)),
    }
  }, [overviewRows])

  // Dados para gráfico de linha por canal
  const lineData = useMemo(() => {
    if (!overviewRows.length) return []
    // agrupa por data
    const byDate = new Map()
    for (const r of overviewRows) {
      const d = r['time.date']
      const ch = r['channel.name']
      const val = Number(r['sales.total_amount']) || 0
      if (!byDate.has(d)) byDate.set(d, { date: d })
      const obj = byDate.get(d)
      obj[ch] = (obj[ch] || 0) + val
    }
    return Array.from(byDate.values()).sort((a,b)=> String(a.date).localeCompare(String(b.date)))
  }, [overviewRows])

  const productBars = useMemo(() => {
    return (topProducts||[]).map(r => ({
      name: r['product.name'],
      revenue: Number(r['products.revenue'])||0,
      quantity: Number(r['products.quantity'])||0,
    }))
  }, [topProducts])

  const palette = ['#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#06b6d4','#ef4444','#22c55e','#3b82f6','#a855f7']

  const titleLabel = useMemo(() => {
    if (rangeType === 'today') return `Hoje (${today})`
    if (rangeType === 'month') return `Mês atual (${monthStartLocal()} a ${today})`
    return `${currentRange[0]} a ${currentRange[1]}`
  }, [rangeType, today, currentRange])

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">Marketing</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="alert alert-info">Carregando...</div>}

      <div className="card mb-3">
        <div className="card-body py-2">
          <div className="d-flex align-items-end gap-2 flex-wrap">
            <div>
              <label className="form-label small mb-1">Período</label>
              <select className="form-select form-select-sm" value={rangeType} onChange={e=>setRangeType(e.target.value)}>
                <option value="today">Hoje</option>
                <option value="month">Mês atual</option>
                <option value="custom">Personalizado</option>
              </select>
            </div>
            {rangeType === 'custom' && (
              <>
                <div>
                  <label className="form-label small mb-1">Início</label>
                  <input type="date" className="form-control form-control-sm" value={dateStart} onChange={e=>setDateStart(e.target.value)} min={limits.sales.min || undefined} max={limits.sales.max || undefined} />
                </div>
                <div>
                  <label className="form-label small mb-1">Fim</label>
                  <input type="date" className="form-control form-control-sm" value={dateEnd} onChange={e=>setDateEnd(e.target.value)} min={limits.sales.min || undefined} max={limits.sales.max || undefined} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="row row-cols-1 row-cols-md-3 g-3 mb-4">
        <SummaryCard title="Faturamento" value={totals.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
        <SummaryCard title="Pedidos" value={Math.round(totals.orders).toLocaleString('pt-BR')} />
        <SummaryCard title="Ticket Médio" value={totals.ticket.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
      </div>

      <div className="card mb-4">
        <div className="card-header fw-semibold">Faturamento diário por canal</div>
        <div className="p-3 chart-320">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={lineData} margin={{ top: 10, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" style={{fontSize: 11}} />
              <YAxis 
                tickFormatter={(v) => {
                  if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v/1000).toFixed(0)}k`
                  return v
                }}
              />
              <Tooltip formatter={(v)=> Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
              <Legend />
              {channels.map((ch, idx) => (
                <Line key={ch} type="monotone" dataKey={ch} stroke={palette[idx % palette.length]} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card mb-4">
        <div className="card-header fw-semibold">Top 10 produtos por receita</div>
        <div className="p-3 chart-480">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={productBars} 
              margin={{ 
                top: 10, 
                right: window.innerWidth < 576 ? 5 : 20, 
                left: window.innerWidth < 576 ? 10 : 60, 
                bottom: window.innerWidth < 576 ? 80 : 130 
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={window.innerWidth < 576 ? -60 : -45} 
                textAnchor="end" 
                interval={0} 
                height={window.innerWidth < 576 ? 60 : 80}
                style={{fontSize: window.innerWidth < 576 ? 9 : 11}}
              />
              <YAxis 
                width={window.innerWidth < 576 ? 40 : 60}
                style={{fontSize: window.innerWidth < 576 ? 9 : 11}}
                tickFormatter={(v) => {
                  if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v/1000).toFixed(0)}k`
                  return v
                }}
              />
              <Tooltip formatter={(v, n)=> n==='revenue' ? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : Number(v).toLocaleString('pt-BR')} />
              <Legend wrapperStyle={{ paddingTop: window.innerWidth < 576 ? '20px' : '40px', fontSize: window.innerWidth < 576 ? '11px' : '14px' }} />
              <Bar dataKey="revenue" name="Receita" fill="#2563eb" />
              <Bar dataKey="quantity" name="Qtde" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {meta && <Explorer role={role} />}
    </div>
  )
}
