// Wrapper de acesso à API do backend (FastAPI)
// - Centraliza URLs e tratamento de erros para facilitar manutenção.
// - Configure VITE_API_BASE_URL no .env.local do frontend para apontar para o backend.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function getMetadata() {
  const res = await fetch(`${API_BASE}/api/metadata`)
  if (!res.ok) throw new Error('Falha ao carregar metadata')
  return res.json()
}

export async function runQuery(body) {
  // Executa consultas analíticas (ver contrato em ARQUITETURA.md)
  const res = await fetch(`${API_BASE}/api/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Erro na consulta: ${msg}`)
  }
  return res.json()
}

export async function getDistinct(body) {
  // Busca valores únicos de uma dimensão, respeitando filtros e papel
  const res = await fetch(`${API_BASE}/api/distinct`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Erro no distinct: ${msg}`)
  }
  return res.json()
}

export async function getDataRange(cube) {
  // Retorna {min_date, max_date} disponíveis para um cube
  const res = await fetch(`${API_BASE}/api/data-range?cube=${encodeURIComponent(cube)}`)
  if (!res.ok) {
    const msg = await res.text()
    throw new Error(`Erro no data-range: ${msg}`)
  }
  return res.json()
}
