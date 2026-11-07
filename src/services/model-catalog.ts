import { useEffect, useState } from 'react'
import { DEFAULT_API_URL } from '@/constants/config'

export interface CatalogModel {
  id: string
  name: string
  promptPrice: number | null
  completionPrice: number | null
}

const CACHE_KEY = 'llm-arena-model-catalog'
const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const pending = new Map<string, Promise<CatalogModel[]>>()

function perMillion(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : Number.NaN
  return Number.isFinite(parsed) && parsed >= 0 ? parsed * 1_000_000 : null
}

function toCatalog(payload: unknown): CatalogModel[] {
  const data = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []
  return data.flatMap((entry) => {
    const record = entry as { id?: unknown; name?: unknown; pricing?: { prompt?: unknown; completion?: unknown } } | null
    if (typeof record?.id !== 'string' || !record.id) return []
    return [{
      id: record.id,
      name: typeof record.name === 'string' ? record.name : record.id,
      promptPrice: perMillion(record.pricing?.prompt),
      completionPrice: perMillion(record.pricing?.completion)
    }]
  })
}

function readCache(apiUrl: string): CatalogModel[] | null {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as { apiUrl: string; at: number; models: CatalogModel[] } | null
    if (!cached || cached.apiUrl !== apiUrl || Date.now() - cached.at > CACHE_TTL_MS) return null
    return Array.isArray(cached.models) ? cached.models : null
  } catch (error) {
    console.warn('模型清單快取讀取失敗', error)
    return null
  }
}

function writeCache(apiUrl: string, models: CatalogModel[]): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ apiUrl, at: Date.now(), models }))
  } catch (error) {
    console.warn('模型清單快取寫入失敗', error)
  }
}

async function fetchCatalog(apiUrl: string): Promise<CatalogModel[]> {
  const response = await fetch(`${apiUrl.replace(/\/$/, '')}/models`)
  if (!response.ok) throw new Error(`模型清單回應 ${response.status}`)
  const models = toCatalog(await response.json())
  if (models.length > 0) writeCache(apiUrl, models)
  return models
}

function loadCatalog(apiUrl: string): Promise<CatalogModel[]> {
  const cached = readCache(apiUrl)
  if (cached) return Promise.resolve(cached)
  const inFlight = pending.get(apiUrl)
  if (inFlight) return inFlight
  const request = fetchCatalog(apiUrl).finally(() => pending.delete(apiUrl))
  pending.set(apiUrl, request)
  return request
}

/** 第一次打開模型選單時才抓清單；抓不到時選單仍可用常用模型與手動輸入。 */
export function useModelCatalog(enabled: boolean, apiUrl: string): { models: CatalogModel[]; isLoading: boolean } {
  const [models, setModels] = useState<CatalogModel[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || models.length > 0) return
    let cancelled = false
    setIsLoading(true)
    loadCatalog(apiUrl || DEFAULT_API_URL)
      .then((next) => { if (!cancelled) setModels(next) })
      .catch((error: unknown) => console.warn('無法載入模型清單，改用常用模型', error))
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [apiUrl, enabled, models.length])

  return { models, isLoading }
}

export function formatPerMillion(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return '免費'
  return value < 0.01 ? `$${value.toExponential(1)}` : `$${value.toFixed(2)}`
}
