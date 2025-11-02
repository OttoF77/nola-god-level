// Simple local-date helpers to avoid UTC off-by-one when using toISOString()

export function toYMDLocal(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayStrLocal() {
  return toYMDLocal(new Date())
}

export function monthStartLocal(date = new Date()) {
  const dt = new Date(date.getFullYear(), date.getMonth(), 1)
  return toYMDLocal(dt)
}

export function clampYMD(dateStr, minStr, maxStr) {
  if (!dateStr) return dateStr
  if (minStr && dateStr < minStr) return minStr
  if (maxStr && dateStr > maxStr) return maxStr
  return dateStr
}
