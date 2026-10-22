import React, { StrictMode, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DataSheetGrid,
  DynamicDataSheetGrid,
  createTextColumn,
  keyColumn,
} from '../src'
import '../src/style.css'

type Row = Record<string, string>
const fields = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const text = createTextColumn<string>({
  continuousUpdates: false,
  deletedValue: '',
  parseUserInput: (value) => value,
})
const initial = Array.from({ length: 12 }, (_, row) =>
  Object.fromEntries(fields.map((field) => [field, `${field}${row}`]))
)
const params = new URLSearchParams(window.location.search)

function Sheet({
  id,
  staticGrid = false,
}: {
  id: string
  staticGrid?: boolean
}) {
  const [data, setData] = useState(initial)
  const [committed, setCommitted] = useState<Record<string, number>>({})
  const [preview, setPreview] = useState<Record<string, number>>({})
  const [commits, setCommits] = useState(0)
  const [enabled, setEnabled] = useState(!params.has('disabled'))
  const [mounted, setMounted] = useState(true)
  const [reverse, setReverse] = useState(false)
  const [selection, setSelection] = useState('null')
  const flexible = params.has('flexible')
  const columns = useMemo(() => {
    const names = flexible ? fields.slice(0, 3) : fields
    return (reverse ? [...names].reverse() : names).map((field) => ({
      ...keyColumn<Row>(field, text),
      title: field,
      basis: 100,
      minWidth: 60,
      maxWidth: flexible ? undefined : 220,
      grow: flexible ? 1 : 0,
      shrink: flexible ? 1 : 0,
    }))
  }, [reverse, flexible])
  const initialWidths = JSON.parse(
    localStorage.getItem(`widths-${id}`) ?? '{}'
  ) as Record<string, number>
  const Grid = staticGrid ? DataSheetGrid : DynamicDataSheetGrid
  return (
    <section aria-label={id}>
      <button onClick={() => setEnabled((value) => !value)}>
        Toggle resizing {id}
      </button>
      <button onClick={() => setMounted((value) => !value)}>
        Toggle grid {id}
      </button>
      <button onClick={() => setReverse((value) => !value)}>
        Reverse columns {id}
      </button>
      <div style={{ width: 500, marginTop: 12 }}>
        {mounted && (
          <Grid
            value={data}
            onChange={setData}
            columns={columns}
            gutterColumn={params.has('noGutter') ? false : { basis: 40 }}
            stickyRightColumn={
              params.has('right') ? { title: 'Actions', basis: 60 } : undefined
            }
            stickyLeftColumnNumber={Number(params.get('sticky') ?? 2)}
            rowHeight={32}
            height={180}
            lockRows
            initialColumnWidths={initialWidths}
            onColumnsResize={
              enabled
                ? (widths) => {
                    setCommitted(widths)
                    setCommits((count) => count + 1)
                    localStorage.setItem(`widths-${id}`, JSON.stringify(widths))
                  }
                : undefined
            }
            onColumnsResizing={setPreview}
            onSelectionChange={({ selection }) =>
              setSelection(JSON.stringify(selection))
            }
          />
        )}
      </div>
      <output data-testid="commits">{commits}</output>
      <output data-testid="committed">{JSON.stringify(committed)}</output>
      <output data-testid="preview">{JSON.stringify(preview)}</output>
      <output data-testid="selection">{selection}</output>
      <pre data-testid="data">{JSON.stringify(data)}</pre>
    </section>
  )
}
const root = document.getElementById('root')
if (!root) throw new Error('Missing fixture root')
createRoot(root).render(
  <StrictMode>
    <Sheet id="main" />
    <Sheet id="second" staticGrid />
  </StrictMode>
)
