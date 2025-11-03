// View: Financeiro — foco em status de vendas, receita por canal e métodos de pagamento
// - Melhoria: legendas de pizza no bottom; barras com espaçamento extra da legenda
// - Usa Explorer para análises ad-hoc com nomes amigáveis e tabela alinhada
import React, { useEffect, useMemo, useState } from 'react'
import { runQuery, getDataRange } from '@/api'
import { todayStrLocal, monthStartLocal } from '@/lib/date'
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import Explorer from '@/components/Explorer'

function Section({ title, children }) {
  return (
    <div className="card mb-4">
      <div className="card-header fw-semibold">{title}</div>
      <div className="card-body p-0">{children}</div>
    </div>
  )
}

export default function FinanceiroView({ meta, role }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [statusMix, setStatusMix] = useState([])
  const [channelMix, setChannelMix] = useState([])
  const [paymentMix, setPaymentMix] = useState([])

  const today = useMemo(() => todayStrLocal(), [])
  const [rangeType, setRangeType] = useState('today')
  const [dateStart, setDateStart] = useState(today)
  const [dateEnd, setDateEnd] = useState(today)
  const [limits, setLimits] = useState({ sales: {min:null, max:null}, payments: {min:null, max:null} })

  useEffect(() => {
    async function loadLimits(){
      try {
        const [s, p] = await Promise.all([getDataRange('sales'), getDataRange('payments')])
        setLimits({ sales: {min:s.min_date||null, max:s.max_date||null}, payments: {min:p.min_date||null, max:p.max_date||null} })
      } catch {}
    }
    loadLimits()
  }, [])

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

  useEffect(() => {
    try {
      localStorage.setItem('ui:period', JSON.stringify({ rangeType, dateStart, dateEnd }))
      window.dispatchEvent(new CustomEvent('ui-period-updated', { detail: { rangeType, dateStart, dateEnd } }))
    } catch {}
  }, [rangeType, dateStart, dateEnd])

  const currentRange = useMemo(() => {
    if (rangeType === 'today') return [today, today]
    if (rangeType === 'month') return [monthStartLocal(), today]
    return [dateStart, dateEnd]
  }, [rangeType, dateStart, dateEnd, today])

  useEffect(() => {
    function onUpdated(ev) {
      const p = ev?.detail
      if (!p || !p.dateStart || !p.dateEnd) return
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
        const sm = await runQuery({
          role: 'financeiro',
          cube: 'sales',
          measures: ['sales.total_amount','sales.orders','sales.ticket_medio'],
          dimensions: ['sales.status'],
          filters: [ { dimension: 'time.date', op: 'between', values: currentRange } ],
          order: [{ by: 'sales.total_amount', dir: 'desc' }],
          limit: 10
        })
        setStatusMix(sm.rows || [])

        const cm = await runQuery({
          role: 'financeiro',
          cube: 'sales',
          measures: ['sales.total_amount','sales.orders','sales.ticket_medio'],
          dimensions: ['channel.name'],
          filters: [ { dimension: 'time.date', op: 'between', values: currentRange } ],
          order: [{ by: 'sales.total_amount', dir: 'desc' }],
          limit: 10
        })
        setChannelMix(cm.rows || [])

        const pm = await runQuery({
          role: 'financeiro',
          cube: 'payments',
          measures: ['payments.amount','payments.count'],
          dimensions: ['payment.type'],
          filters: [ { dimension: 'time.date', op: 'between', values: currentRange } ],
          order: [{ by: 'payments.amount', dir: 'desc' }],
          limit: 20
        })
        setPaymentMix(pm.rows || [])
      } catch (e) {
        setError(String(e.message || e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentRange])

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">Financeiro</h2>
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
      {error && <div className="alert alert-danger">{error}</div>}
      {loading && <div className="alert alert-info">Carregando...</div>}

      <Section title="Mix por status">
        <div className="p-3 chart-380">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(v)=> Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
              <Legend verticalAlign="bottom" height={50} />
              <Pie dataKey="value" nameKey="name" data={statusMix.map(r=>({ name: r['sales.status'], value: Number(r['sales.total_amount'])||0 }))} outerRadius={100} label>
                {statusMix.map((r, idx) => {
                  const COLORS = ['#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#06b6d4','#ef4444','#22c55e','#3b82f6','#a855f7']
                  return <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Receita por canal">
        <div className="p-3 chart-460">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart 
              data={channelMix.map(r=>({ name: r['channel.name'], amount: Number(r['sales.total_amount'])||0, orders: Number(r['sales.orders'])||0 }))}
              margin={{ top: 10, right: 20, left: 60, bottom: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-35} 
                textAnchor="end" 
                height={60}
                style={{fontSize: 11}}
              />
              <YAxis 
                tickFormatter={(v) => {
                  if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v/1000).toFixed(0)}k`
                  return v
                }}
              />
              <Tooltip formatter={(v,n)=> n==='amount' ? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : Number(v).toLocaleString('pt-BR')} />
              <Legend wrapperStyle={{ paddingTop: '40px' }} />
              <Bar dataKey="amount" name="Faturamento" fill="#2563eb" />
              <Bar dataKey="orders" name="Pedidos" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Mix por método de pagamento">
        <div className="p-3 chart-380">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(v)=> Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
              <Legend verticalAlign="bottom" height={50} />
              <Pie dataKey="value" nameKey="name" data={paymentMix.map(r=>({ name: r['payment.type'], value: Number(r['payments.amount'])||0 }))} outerRadius={100} label>
                {paymentMix.map((r, idx) => {
                  const COLORS = ['#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#06b6d4','#ef4444','#22c55e','#3b82f6','#a855f7']
                  return <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {meta && <Explorer role={role} />}
    </div>
  )
}
