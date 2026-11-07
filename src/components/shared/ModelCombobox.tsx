import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettingsStore } from '@/stores/settings-store'
import { formatPerMillion, useModelCatalog } from '@/services/model-catalog'
import type { CatalogModel } from '@/services/model-catalog'
import { Spinner } from './icons'

const MAX_CATALOG_ROWS = 60
const MENU_MAX_HEIGHT = 320

interface ModelComboboxProps {
  value: string
  disabled?: boolean
  ariaLabel: string
  placeholder?: string
  className?: string
  onChange: (value: string) => void
  onPick?: (value: string) => void
  onEnter?: () => void
}

interface MenuPosition {
  left: number
  width: number
  top?: number
  bottom?: number
}

function matches(model: { id: string; name: string }, terms: string[]): boolean {
  const haystack = `${model.id} ${model.name}`.toLowerCase()
  return terms.every((term) => haystack.includes(term))
}

function getMenuPosition(input: HTMLElement): MenuPosition {
  const rect = input.getBoundingClientRect()
  const width = Math.min(Math.max(rect.width, 440), window.innerWidth - 24)
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
  const hasRoomBelow = window.innerHeight - rect.bottom > Math.min(MENU_MAX_HEIGHT, 200) + 12
  return hasRoomBelow
    ? { left, width, top: rect.bottom + 4 }
    : { left, width, bottom: window.innerHeight - rect.top + 4 }
}

function useModelOptions(value: string, isOpen: boolean): {
  common: CatalogModel[]
  catalog: CatalogModel[]
  hiddenCount: number
  isLoading: boolean
} {
  const apiUrl = useSettingsStore((state) => state.apiUrl)
  const modelList = useSettingsStore((state) => state.modelList)
  const { models, isLoading } = useModelCatalog(isOpen, apiUrl)

  return useMemo(() => {
    const byId = new Map(models.map((model) => [model.id, model]))
    const allCommon = modelList.map((id) => byId.get(id) ?? { id, name: id, promptPrice: null, completionPrice: null })
    const commonIds = new Set(modelList)
    const others = models.filter((model) => !commonIds.has(model.id))
    // 已經選好模型時展開要看到全部選項，不是只剩自己
    const isExact = allCommon.some((model) => model.id === value) || others.some((model) => model.id === value)
    const terms = isExact ? [] : value.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matchedOthers = others.filter((model) => matches(model, terms))
    return {
      common: allCommon.filter((model) => matches(model, terms)),
      catalog: matchedOthers.slice(0, MAX_CATALOG_ROWS),
      hiddenCount: Math.max(0, matchedOthers.length - MAX_CATALOG_ROWS),
      isLoading
    }
  }, [isLoading, modelList, models, value])
}

function OptionRow({ model, optionId, active, selected, onPick, onHover }: {
  model: CatalogModel
  optionId: string
  active: boolean
  selected: boolean
  onPick: () => void
  onHover: () => void
}): JSX.Element {
  const hasPrice = model.promptPrice !== null || model.completionPrice !== null
  const isFree = model.promptPrice === 0 && model.completionPrice === 0
  return (
    <li
      id={optionId}
      role="option"
      aria-selected={selected}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onPick}
      onMouseMove={onHover}
      className={`flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 ${active ? 'bg-sunken' : ''}`}
    >
      <span className="min-w-0 flex-1">
        <span className={`block truncate font-mono text-xs text-ink ${selected ? 'font-semibold' : ''}`}>{model.id}</span>
        {model.name !== model.id && <span className="block truncate text-[11px] text-faint">{model.name}</span>}
      </span>
      {hasPrice && (
        <span className="num shrink-0 text-[11px] text-muted">
          {isFree ? '免費' : `${formatPerMillion(model.promptPrice)} / ${formatPerMillion(model.completionPrice)}`}
        </span>
      )}
    </li>
  )
}

export function ModelCombobox({ value, disabled, ariaLabel, placeholder = '搜尋或輸入模型 ID', className = '', onChange, onPick, onEnter }: ModelComboboxProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const baseId = useId()
  const { common, catalog, hiddenCount, isLoading } = useModelOptions(value, isOpen)
  const options = useMemo(() => [...common, ...catalog], [catalog, common])

  const reposition = useCallback(() => {
    if (inputRef.current) setPosition(getMenuPosition(inputRef.current))
  }, [])

  const open = useCallback(() => {
    reposition()
    setIsOpen(true)
  }, [reposition])

  useEffect(() => {
    if (!isOpen) return
    const handlePointerDown = (event: MouseEvent): void => {
      const target = event.target as Node
      if (!inputRef.current?.contains(target) && !menuRef.current?.contains(target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('scroll', reposition, true)
    window.addEventListener('resize', reposition)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
    }
  }, [isOpen, reposition])

  useEffect(() => {
    setActiveIndex(-1)
  }, [value])

  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`${baseId}-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, baseId])

  const pick = (id: string): void => {
    onChange(id)
    onPick?.(id)
    setIsOpen(false)
    inputRef.current?.blur()
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!isOpen) open()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      if (options.length > 0) setActiveIndex((current) => (current + delta + options.length) % options.length)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (isOpen && options[activeIndex]) pick(options[activeIndex].id)
      else {
        setIsOpen(false)
        onEnter?.()
      }
    } else if (event.key === 'Escape' && isOpen) {
      event.preventDefault()
      setIsOpen(false)
    } else if (event.key === 'Tab') {
      setIsOpen(false)
    }
  }

  const renderRow = (model: CatalogModel, index: number): JSX.Element => (
    <OptionRow
      key={model.id}
      model={model}
      optionId={`${baseId}-${index}`}
      active={index === activeIndex}
      selected={model.id === value}
      onPick={() => pick(model.id)}
      onHover={() => setActiveIndex(index)}
    />
  )

  const showMenu = isOpen && position && (options.length > 0 || isLoading)
  return (
    <>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={Boolean(showMenu)}
        aria-controls={`${baseId}-list`}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${baseId}-${activeIndex}` : undefined}
        autoComplete="off"
        spellCheck={false}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          onChange(event.target.value)
          open()
        }}
        onFocus={open}
        onKeyDown={handleKeyDown}
        className={`field font-mono ${className}`}
      />
      {showMenu && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', zIndex: 60, maxHeight: MENU_MAX_HEIGHT, ...position }}
          className="card-enter overflow-y-auto rounded-lg border border-line-strong bg-raised p-1 shadow-pop"
        >
          <ul id={`${baseId}-list`} role="listbox" aria-label={ariaLabel}>
            {common.length > 0 && <li role="presentation" className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-faint">常用模型</li>}
            {common.map((model, index) => renderRow(model, index))}
            {catalog.length > 0 && <li role="presentation" className="px-2 pb-1 pt-2.5 text-[11px] font-medium text-faint">OpenRouter 全部模型（輸入 / 輸出，每百萬 token）</li>}
            {catalog.map((model, index) => renderRow(model, common.length + index))}
          </ul>
          {isLoading && (
            <p className="flex items-center gap-2 px-2 py-2 text-xs text-muted"><Spinner />載入模型清單中</p>
          )}
          {hiddenCount > 0 && <p className="px-2 py-2 text-xs text-faint">還有 {hiddenCount} 個模型，繼續輸入可以縮小範圍</p>}
        </div>,
        document.body
      )}
    </>
  )
}
