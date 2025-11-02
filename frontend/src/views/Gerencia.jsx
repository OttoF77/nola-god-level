// View: Gerência — visão consolidada por lojas, canais e evolução mensal
// - Seções: Top 10 lojas (barras), Faturamento por canal (pizza), Evolução mensal (linha)
// - Compartilha período com outras views via localStorage
import React, { useEffect, useMemo, useState } from 'react'
import { runQuery, getDataRange } from '@/api'
import { todayStrLocal, monthStartLocal } from '@/lib/date'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import Explorer from '@/components/Explorer'

function Section({ title, children }) {
  return (
    <div className="card mb-4">
      <div className="card-header fw-semibold">{title}</div>
      <div className="card-body p-0">
        {children}
      </div>
    </div>
  )
}

export default function GerenciaView({ meta, role }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [topStores, setTopStores] = useState([])
  const [byChannel, setByChannel] = useState([])
  const [monthly, setMonthly] = useState([])

  const today = useMemo(() => todayStrLocal(), [])
  const [rangeType, setRangeType] = useState('today') // today | month | custom
  const [dateStart, setDateStart] = useState(today)
  const [dateEnd, setDateEnd] = useState(today)
  const [limits, setLimits] = useState({ sales: {min:null, max:null} })

  useEffect(() => {
    async function loadLimits(){
      try {
        const s = await getDataRange('sales')
        setLimits({ sales: {min:s.min_date||null, max:s.max_date||null} })
      } catch {}
    }
    loadLimits()
  }, [])

  // Sincronização de período global
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

  const lastMonthsRange = useMemo(() => {
    // últimos 6 meses até o fim de currentRange
    const endStr = currentRange[1]
    const [y, m, d] = endStr.split('-').map(Number)
    const end = new Date(y, (m||1)-1, d||1)
    const start = new Date(end.getFullYear(), end.getMonth() - 5, 1)
    const pad = (n) => String(n).padStart(2, '0')
    const fmt = (dt) => `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}`
    return [fmt(start), fmt(end)]
  }, [currentRange])

  // Two-way sync: ouvir ui-period-updated
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
        // Top 10 lojas por faturamento no mês
        const ts = await runQuery({
          role: 'gerencia',
          cube: 'sales',
          measures: ['sales.total_amount','sales.orders','sales.ticket_medio'],
          dimensions: ['store.name'],
          filters: [
            { dimension: 'sales.status', op: 'equals', values: ['COMPLETED'] },
            { dimension: 'time.date', op: 'between', values: currentRange }
          ],
          order: [{ by: 'sales.total_amount', dir: 'desc' }],
          limit: 10
        })
        setTopStores(ts.rows || [])

        // Faturamento por canal no mês
        const bc = await runQuery({
          role: 'gerencia',
          cube: 'sales',
          measures: ['sales.total_amount','sales.orders','sales.ticket_medio'],
          dimensions: ['channel.name'],
          filters: [
            { dimension: 'sales.status', op: 'equals', values: ['COMPLETED'] },
            { dimension: 'time.date', op: 'between', values: currentRange }
          ],
          order: [{ by: 'sales.total_amount', dir: 'desc' }],
          limit: 10
        })
        setByChannel(bc.rows || [])

        // Evolução mensal (6 meses)
        const mo = await runQuery({
          role: 'gerencia',
          cube: 'sales',
          measures: ['sales.total_amount','sales.orders','sales.ticket_medio'],
          dimensions: ['time.date'],
          filters: [
            { dimension: 'sales.status', op: 'equals', values: ['COMPLETED'] },
            { dimension: 'time.date', op: 'between', values: lastMonthsRange }
          ],
          granularity: 'month',
          order: [{ by: 'time.date', dir: 'asc' }],
          limit: 12
        })
        setMonthly(mo.rows || [])
      } catch (e) {
        setError(String(e.message || e))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [currentRange, lastMonthsRange])

  return (
    <div className="container-fluid py-3">
      <h2 className="mb-3">Gerência</h2>
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

      <Section title="Top 10 lojas por faturamento">
        <div className="p-3" style={{height: 480}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topStores.map(r=>({
              name: r['store.name'],
              amount: Number(r['sales.total_amount'])||0,
              orders: Number(r['sales.orders'])||0,
            }))} margin={{ top: 10, right: 20, left: 60, bottom: 130 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                interval={0} 
                height={80}
                style={{fontSize: 11}}
              />
              <YAxis 
                tickFormatter={(v) => {
                  if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v/1000).toFixed(0)}k`
                  return v
                }}
              />
              <Tooltip formatter={(v,n)=> n==='amount'? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : Number(v).toLocaleString('pt-BR')} />
              <Legend wrapperStyle={{ paddingTop: '40px' }} />
              <Bar dataKey="amount" name="Faturamento" fill="#2563eb" />
              <Bar dataKey="orders" name="Pedidos" fill="#16a34a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Faturamento por canal">
        <div className="p-3" style={{height: 380}}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip formatter={(v)=> Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})} />
              <Legend verticalAlign="bottom" height={50} />
              <Pie dataKey="value" nameKey="name" data={byChannel.map((r,idx)=>({
                name: r['channel.name'],
                value: Number(r['sales.total_amount'])||0
              }))} outerRadius={100} label>
                {byChannel.map((r, idx) => {
                  const COLORS = ['#2563eb','#16a34a','#dc2626','#9333ea','#f59e0b','#06b6d4','#ef4444','#22c55e','#3b82f6','#a855f7']
                  return <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                })}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Evolução mensal (últimos 6 meses)">
        <div className="p-3" style={{height: 320}}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthly.map(r=>({
              month: new Date(r['time.date']).toLocaleDateString('pt-BR',{year:'2-digit', month:'2-digit'}),
              amount: Number(r['sales.total_amount'])||0,
              orders: Number(r['sales.orders'])||0,
            }))} margin={{ top: 10, right: 20, left: 60, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" style={{fontSize: 11}} />
              <YAxis 
                tickFormatter={(v) => {
                  if (v >= 1000000) return `${(v/1000000).toFixed(1)}M`
                  if (v >= 1000) return `${(v/1000).toFixed(0)}k`
                  return v
                }}
              />
              <Tooltip formatter={(v,n)=> n==='amount'? Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) : Number(v).toLocaleString('pt-BR')} />
              <Legend />
              <Line type="monotone" dataKey="amount" name="Faturamento" stroke="#2563eb" dot={false} />
              <Line type="monotone" dataKey="orders" name="Pedidos" stroke="#16a34a" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {meta && <Explorer role={role} />}
    </div>
  )
}
