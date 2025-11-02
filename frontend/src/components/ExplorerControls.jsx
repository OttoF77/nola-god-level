// ExplorerControls: painel lateral para montar consultas de forma visual
// - Permite escolher cube, medidas, dimensões, filtros e granularidade
// - Aplica nomes amigáveis PT-BR e faz auto-run com debounce
// - Sincroniza período global via localStorage e envia eventos customizados
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { runQuery, getDistinct } from '@/api'
import { monthStartLocal, todayStrLocal } from '@/lib/date'

// Mapeamento de nomes técnicos para nomes amigáveis
const friendlyNames = {
  // Medidas
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
  // Dimensões
  'time.date': 'Data',
  'store.name': 'Filial',
  'channel.name': 'Canal',
  'product.name': 'Produto',
  'sales.status': 'Status da Venda',
  'payment.type': 'Tipo de Pagamento',
  'payment.online': 'Pagamento Online',
}

function getFriendlyName(technicalName) {
  return friendlyNames[technicalName] || technicalName
}

function CheckboxList({ options, selected, onToggle }) {
  return (
    <div className="d-flex flex-column gap-2">
      {options.map((opt) => (
        <div className="form-check" key={opt}>
          <input
            className="form-check-input"
            type="checkbox"
            id={`ctl-${opt}`}
            checked={selected.includes(opt)}
            onChange={() => onToggle(opt)}
          />
          <label className="form-check-label" htmlFor={`ctl-${opt}`}>{getFriendlyName(opt)}</label>
        </div>
      ))}
    </div>
  )
}

export default function ExplorerControls({ role, meta }) {
  const roles = meta?.roles || {}
  const cubes = meta?.cubes || {}

  const allowedCubes = useMemo(() => {
    if (!role || !roles[role]?.cubes) return Object.keys(cubes)
    return roles[role].cubes.filter((c) => cubes[c])
  }, [role, roles, cubes])

  const [cube, setCube] = useState(allowedCubes[0] || 'sales')
  const skipResetRef = useRef(false)
  useEffect(() => {
    if (!allowedCubes.includes(cube)) setCube(allowedCubes[0] || 'sales')
  }, [allowedCubes])

  const roleAllowedMeasures = useMemo(() => new Set(roles[role]?.allowed_measures || []), [role, roles])
  const roleAllowedDims = useMemo(() => new Set(roles[role]?.allowed_dimensions || []), [role, roles])

  const cubeMeasures = useMemo(() => (cubes[cube]?.measures || []).filter(m => roleAllowedMeasures.size ? roleAllowedMeasures.has(m) : true), [cubes, cube, roleAllowedMeasures])
  const cubeDims = useMemo(() => (cubes[cube]?.dimensions || []).filter(d => roleAllowedDims.size ? roleAllowedDims.has(d) : true), [cubes, cube, roleAllowedDims])

  const defaultStart = monthStartLocal()
  const defaultEnd = todayStrLocal()

  const [measures, setMeasures] = useState([])
  const [dimensions, setDimensions] = useState([])
  const [dateStart, setDateStart] = useState(defaultStart)
  const [dateEnd, setDateEnd] = useState(defaultEnd)
  const [granularity, setGranularity] = useState('day')
  const [statusCompleted, setStatusCompleted] = useState(false)
  const [limit, setLimit] = useState(50)
  const [orderBy, setOrderBy] = useState('')

  // Filtros por valores (multi-select)
  const [channelOptions, setChannelOptions] = useState([])
  const [storeOptions, setStoreOptions] = useState([])
  const [paymentTypeOptions, setPaymentTypeOptions] = useState([])
  const [selectedChannels, setSelectedChannels] = useState([])
  const [selectedStores, setSelectedStores] = useState([])
  const [selectedPaymentTypes, setSelectedPaymentTypes] = useState([])

  useEffect(() => {
    // reset selections when cube changes, unless we're restoring from storage
    if (skipResetRef.current) {
      skipResetRef.current = false
      return
    }
    setMeasures([])
    setDimensions([])
    setOrderBy('')
    setSelectedChannels([])
    setSelectedStores([])
    setSelectedPaymentTypes([])
  }, [cube])

  // Inicializa período a partir do período global das views (se houver)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ui:period')
      if (!raw) return
      const p = JSON.parse(raw)
      if (!p) return
      if (p.rangeType === 'today') {
        setDateStart(p.dateStart)
        setDateEnd(p.dateEnd)
      } else if (p.rangeType === 'month') {
        // 1º do mês até a data salva (ou hoje)
        const d = p.dateEnd || new Date().toISOString().slice(0,10)
        const [y,m] = (d||'').split('-')
        const ds = `${y}-${m}-01`
        setDateStart(ds)
        setDateEnd(d)
      } else if (p.rangeType === 'custom') {
        if (p.dateStart) setDateStart(p.dateStart)
        if (p.dateEnd) setDateEnd(p.dateEnd)
      }
    } catch {}
  }, [])

  // Two-way sync: quando usuário alterar datas no Explorer, propagar período às views
  useEffect(() => {
    try {
      if (!dateStart || !dateEnd) return
      localStorage.setItem('ui:period', JSON.stringify({ rangeType: 'custom', dateStart, dateEnd }))
      window.dispatchEvent(new CustomEvent('ui-period-updated', { detail: { rangeType: 'custom', dateStart, dateEnd } }))
    } catch {}
  }, [dateStart, dateEnd])

  const canUseTime = useMemo(() => cubeDims.includes('time.date'), [cubeDims])
  const canUseStatus = useMemo(() => cubeDims.includes('sales.status'), [cubeDims])
  const canFilterChannel = useMemo(() => cubeDims.includes('channel.name'), [cubeDims])
  const canFilterStore = useMemo(() => cubeDims.includes('store.name'), [cubeDims])
  const canFilterPayType = useMemo(() => cubeDims.includes('payment.type'), [cubeDims])

  // Carrega opções distintas quando cube/período/status mudam
  useEffect(() => {
    async function loadDistincts() {
      try {
        const commonFilters = []
        if (canUseTime && dateStart && dateEnd) {
          commonFilters.push({ dimension: 'time.date', op: 'between', values: [dateStart, dateEnd] })
        }
        if (canUseStatus && statusCompleted) {
          commonFilters.push({ dimension: 'sales.status', op: 'equals', values: ['COMPLETED'] })
        }
        if (canFilterChannel) {
          const { values } = await getDistinct({ role, cube, dimension: 'channel.name', filters: commonFilters, limit: 200 })
          setChannelOptions(values || [])
        } else {
          setChannelOptions([])
        }
        if (canFilterStore) {
          const { values } = await getDistinct({ role, cube, dimension: 'store.name', filters: commonFilters, limit: 200 })
          setStoreOptions(values || [])
        } else {
          setStoreOptions([])
        }
        if (canFilterPayType) {
          const { values } = await getDistinct({ role, cube, dimension: 'payment.type', filters: commonFilters, limit: 200 })
          setPaymentTypeOptions(values || [])
        } else {
          setPaymentTypeOptions([])
        }
      } catch (e) {
        // silencioso
      }
    }
    loadDistincts()
  }, [cube, role, canUseTime, canUseStatus, canFilterChannel, canFilterStore, canFilterPayType, dateStart, dateEnd, statusCompleted])

  function toggleMeasure(m) {
    setMeasures(prev => {
      const next = prev.includes(m) ? prev.filter(x => x!==m) : [...prev, m]
      setTimeout(() => triggerRun(), 300)
      return next
    })
  }
  function toggleDim(d) {
    setDimensions(prev => {
      const next = prev.includes(d) ? prev.filter(x => x!==d) : [...prev, d]
      setTimeout(() => triggerRun(), 300)
      return next
    })
  }

  const runRef = useRef(null)
  async function run() {
    const filters = []
    if (canUseTime && dateStart && dateEnd) {
      filters.push({ dimension: 'time.date', op: 'between', values: [dateStart, dateEnd] })
    }
    if (canUseStatus && statusCompleted) {
      filters.push({ dimension: 'sales.status', op: 'equals', values: ['COMPLETED'] })
    }
    if (canFilterChannel && selectedChannels.length) {
      filters.push({ dimension: 'channel.name', op: 'in', values: selectedChannels })
    }
    if (canFilterStore && selectedStores.length) {
      filters.push({ dimension: 'store.name', op: 'in', values: selectedStores })
    }
    if (canFilterPayType && selectedPaymentTypes.length) {
      filters.push({ dimension: 'payment.type', op: 'in', values: selectedPaymentTypes })
    }
    const order = []
    const orderField = orderBy || measures[0]
    if (orderField) order.push({ by: orderField, dir: 'desc' })

    const body = {
      role,
      cube,
      measures: measures.length ? measures : cubeMeasures.slice(0,1),
      dimensions,
      filters,
      granularity: canUseTime ? granularity : null,
      order,
      limit: Math.max(1, Math.min(10000, Number(limit) || 50)),
    }
    const data = await runQuery(body)
    // persist state and result
    const state = {
      cube, measures, dimensions, dateStart, dateEnd, granularity, statusCompleted, limit, orderBy,
      selectedChannels, selectedStores, selectedPaymentTypes,
    }
    try {
      localStorage.setItem(`explorer:${role}`, JSON.stringify(state))
      localStorage.setItem(`explorer:${role}:result`, JSON.stringify({ rows: data.rows || [], columns: data.columns || [] }))
    } catch {}
    // notify listeners
    try { window.dispatchEvent(new CustomEvent('explorer-updated', { detail: { role } })) } catch {}
  }

  runRef.current = run

  function triggerRun() {
    if (runRef.current) runRef.current()
  }

  // Auto-run quando filtros/parâmetros mudam
  useEffect(() => {
    const timer = setTimeout(() => {
      // Atualiza sempre que filtros/parametros mudarem
      triggerRun()
    }, 400)
    return () => clearTimeout(timer)
  }, [cube, dateStart, dateEnd, granularity, statusCompleted, limit, orderBy, selectedChannels, selectedStores, selectedPaymentTypes, measures, dimensions])

  return (
    <div className="sidebar-controls small">
      <div className="text-muted text-uppercase small mb-2">Análise livre</div>
      <div className="mb-2">
        <label className="form-label">Cube</label>
        <select className="form-select form-select-sm" value={cube} onChange={e=>setCube(e.target.value)}>
          {allowedCubes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label">Ordenar por</label>
        <select className="form-select form-select-sm" value={orderBy} onChange={e=>setOrderBy(e.target.value)}>
          <option value="">(primeira medida)</option>
          {measures.map(m => <option key={m} value={m}>{getFriendlyName(m)}</option>)}
        </select>
      </div>
      <div className="mb-2">
        <label className="form-label">Limite</label>
        <input type="number" className="form-control form-control-sm" value={limit} onChange={e=>setLimit(e.target.value)} />
      </div>

      <div className="mb-2">
        <div className="fw-semibold mb-1">Medidas</div>
        <CheckboxList options={cubeMeasures} selected={measures} onToggle={toggleMeasure} />
      </div>
      <div className="mb-2">
        <div className="fw-semibold mb-1">Dimensões</div>
        <CheckboxList options={cubeDims} selected={dimensions} onToggle={toggleDim} />
      </div>

      <div className="mb-2">
        <label className="form-label">Granularidade</label>
        <select className="form-select form-select-sm" disabled={!canUseTime} value={granularity} onChange={e=>setGranularity(e.target.value)}>
          <option value="hour">Hora</option>
          <option value="day">Dia</option>
          <option value="month">Mês</option>
        </select>
      </div>
      {canUseStatus && (
        <div className="form-check mb-2">
          <input className="form-check-input" type="checkbox" id="ctl-only-completed" checked={statusCompleted} onChange={()=>setStatusCompleted(v=>!v)} />
          <label className="form-check-label" htmlFor="ctl-only-completed">Somente Entregues</label>
        </div>
      )}

      {canFilterChannel && (
        <div className="mb-2">
          <label className="form-label">Canais (multi)</label>
          <select multiple className="form-select form-select-sm" value={selectedChannels} onChange={e=> setSelectedChannels(Array.from(e.target.selectedOptions).map(o=>o.value))}>
            {channelOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}
      {canFilterStore && (
        <div className="mb-2">
          <label className="form-label">Lojas (multi)</label>
          <select multiple className="form-select form-select-sm" value={selectedStores} onChange={e=> setSelectedStores(Array.from(e.target.selectedOptions).map(o=>o.value))}>
            {storeOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}
      {canFilterPayType && (
        <div className="mb-3">
          <label className="form-label">Métodos de pagamento (multi)</label>
          <select multiple className="form-select form-select-sm" value={selectedPaymentTypes} onChange={e=> setSelectedPaymentTypes(Array.from(e.target.selectedOptions).map(o=>o.value))}>
            {paymentTypeOptions.map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      )}

      <div className="d-grid gap-2">
        <button className="btn btn-outline-secondary btn-sm" onClick={() => {
          setMeasures([])
          setDimensions([])
          setSelectedChannels([])
          setSelectedStores([])
          setSelectedPaymentTypes([])
          setOrderBy('')
        }}>Limpar filtros</button>
        <div className="text-muted small text-center" style={{fontSize: '0.7rem'}}>
          <i className="bi bi-info-circle"></i> Resultados atualizam automaticamente
        </div>
      </div>
    </div>
  )
}
