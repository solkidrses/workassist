'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

type Category = {
  id: string
  name: string
  slug: string
  color?: string | null
  icon?: string | null
}

type Props = {
  categories: Category[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export function CategorySelect({ categories, value, onChange, placeholder = 'Выбрать категорию', disabled }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = categories.find(c => c.slug === value || c.id === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        className="input-field"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          textAlign: 'left',
          overflow: 'hidden',
        }}
        disabled={disabled}
      >
        <span style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          fontSize: 15,
          fontWeight: 500,
          color: selected ? 'var(--text-main)' : 'var(--text-muted)',
        }}>
          {selected && selected.color && (
            <span style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: selected.color,
              flexShrink: 0,
            }} />
          )}
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          size={18}
          style={{
            color: 'var(--text-muted)',
            flexShrink: 0,
            transition: 'transform 0.2s var(--ease-out)',
            transform: open ? 'rotate(180deg)' : 'none',
          }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
            zIndex: 100,
            maxHeight: 240,
            overflowY: 'auto',
            animation: 'fade-in-up 0.18s var(--ease-out) both',
          }}
        >
          {categories.map((c, i) => {
            const isActive = (c.slug === value || c.id === value)
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onChange(c.slug || c.id)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '11px 14px',
                  background: isActive ? 'var(--accent-transparent)' : 'transparent',
                  border: 'none',
                  borderBottom: i < categories.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                  cursor: 'pointer',
                  color: isActive ? 'var(--text-main)' : 'var(--text-main)',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                }}
              >
                {c.color && (
                  <span style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: c.color,
                    flexShrink: 0,
                  }} />
                )}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.name}
                </span>
                {isActive && (
                  <Check size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
