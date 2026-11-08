// components/print/InvoicePreviewModal.tsx
// Reusable A4 invoice preview modal with compact toolbar + font-scale control
import { useState } from 'react'
import { X } from 'lucide-react'
import A4InvoiceTemplate from './A4InvoiceTemplate'

// Scale range from 0.5 to 1.5 with 0.05 increments
const SCALES = [
  0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 0.95,
  1, 1.05, 1.1, 1.15, 1.2, 1.25, 1.3, 1.35, 1.4, 1.45, 1.5
]
const LS_KEY = 'apexbill_a4_font_scale'

function readScale(): number {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return 1
    const v = parseFloat(raw)
    const matched = SCALES.find(s => Math.abs(s - v) < 0.001)
    return matched !== undefined ? matched : 1
  } catch {
    return 1
  }
}

interface Props {
  doc: any
  profile: any
  title: string
  titleIcon?: React.ReactNode
  titleBadge?: React.ReactNode
  actions?: React.ReactNode
  onClose: () => void
  qrMode?: 'default' | 'balance'
  templateRef?: React.RefObject<HTMLDivElement>
}

export default function InvoicePreviewModal({
  doc, profile, title, titleIcon, titleBadge,
  actions, onClose, qrMode = 'default', templateRef,
}: Props) {
  const [fontScale, setFontScale] = useState<number>(readScale)

  const handleScale = (s: number) => {
    setFontScale(s)
    try { localStorage.setItem(LS_KEY, String(s)) } catch { /* ignore */ }
  }

  const currentIndex = (() => {
    const idx = SCALES.findIndex(s => Math.abs(s - fontScale) < 0.001)
    return idx === -1 ? SCALES.indexOf(1) : idx
  })()

  const handleDecrease = () => {
    if (currentIndex > 0) {
      handleScale(SCALES[currentIndex - 1])
    }
  }

  const handleIncrease = () => {
    if (currentIndex < SCALES.length - 1) {
      handleScale(SCALES[currentIndex + 1])
    }
  }

  const visibleScales = (() => {
    if (currentIndex <= 0) {
      return SCALES.slice(0, 3)
    }
    if (currentIndex >= SCALES.length - 1) {
      return SCALES.slice(SCALES.length - 3)
    }
    return [SCALES[currentIndex - 1], SCALES[currentIndex], SCALES[currentIndex + 1]]
  })()

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[95vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Compact Toolbar ── */}
        <div className="no-print sticky top-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2 bg-gray-900 rounded-t-2xl border-b border-white/10">

          {/* Left: title + badge */}
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {titleIcon && <span className="flex-shrink-0">{titleIcon}</span>}
            <span className="font-semibold text-sm text-white truncate leading-none">{title}</span>
            {titleBadge && <span className="flex-shrink-0">{titleBadge}</span>}
          </div>

          {/* Centre: AA- {3 visible scales with current in between} AA+ */}
          <div className="flex items-center gap-1.5 flex-shrink-0 select-none">
            <button
              type="button"
              onClick={handleDecrease}
              disabled={currentIndex <= 0}
              title="Decrease scale (AA-)"
              className="px-2 py-1 rounded-md text-[11px] font-bold tracking-tight bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-white/10"
            >
              AA-
            </button>

            <div className="flex gap-px bg-white/5 rounded-lg p-0.5 border border-white/10">
              {visibleScales.map(s => {
                const isSelected = Math.abs(s - fontScale) < 0.001
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleScale(s)}
                    title={`Font size ${s === 1 ? 'default (1×)' : s + '×'}`}
                    style={{
                      fontSize: 10.5,
                      fontWeight: isSelected ? 700 : 400,
                      padding: '3px 7px',
                      borderRadius: 5,
                      border: 'none',
                      background: isSelected ? '#4f46e5' : 'transparent',
                      color: isSelected ? '#fff' : '#94a3b8',
                      cursor: 'pointer',
                      lineHeight: 1.4,
                      minWidth: 38,
                      textAlign: 'center',
                      transition: 'background 0.1s, color 0.1s',
                    }}
                  >
                    {s === 1 ? '1×' : s}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleIncrease}
              disabled={currentIndex >= SCALES.length - 1}
              title="Increase scale (AA+)"
              className="px-2 py-1 rounded-md text-[11px] font-bold tracking-tight bg-white/10 hover:bg-white/20 text-gray-200 disabled:opacity-30 disabled:pointer-events-none transition-colors border border-white/10"
            >
              AA+
            </button>
          </div>

          {/* Right: action buttons + close */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {actions}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors ml-0.5"
              title="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── A4 Invoice Body ── */}
        <div ref={templateRef}>
          <A4InvoiceTemplate
            doc={doc}
            profile={profile}
            qrMode={qrMode}
            fontScale={fontScale}
          />
        </div>
      </div>
    </div>
  )
}
