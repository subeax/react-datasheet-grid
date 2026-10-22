import React, { StrictMode, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import {
  DataSheetGrid,
  DataSheetGridRef,
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
const columns = fields.map((field) => ({
  ...keyColumn<Row>(field, text),
  title: field,
  basis: 100,
  minWidth: 100,
  grow: 0,
  shrink: 0,
}))
const params = new URLSearchParams(window.location.search)
const initial = Array.from({ length: 12 }, (_, row) =>
  Object.fromEntries(fields.map((field) => [field, `${field}${row}`]))
)
function Fixture() {
  const ref = useRef<DataSheetGridRef>(null)
  const [data, setData] = useState(initial)
  const [sticky, setSticky] = useState(Number(params.get('sticky') ?? 2))
  const [selection, setSelection] = useState('null')
  return (
    <>
      <button onClick={() => setSticky((value) => (value === 0 ? 2 : 0))}>
        Toggle frozen
      </button>
      <button onClick={() => ref.current?.setActiveCell({ row: 0, col: 0 })}>
        Focus first
      </button>
      <div style={{ width: 500, marginTop: 20 }}>
        <DataSheetGrid
          ref={ref}
          value={data}
          onChange={setData}
          columns={columns}
          gutterColumn={params.has('noGutter') ? false : { basis: 40 }}
          stickyRightColumn={
            params.has('right') ? { title: 'Actions', basis: 60 } : undefined
          }
          stickyLeftColumnNumber={sticky}
          rowHeight={32}
          height={240}
          lockRows
          onSelectionChange={({ selection }) =>
            setSelection(JSON.stringify(selection))
          }
        />
      </div>
      <output id="selection">{selection}</output>
      <pre id="data">{JSON.stringify(data)}</pre>
    </>
  )
}
const root = document.getElementById('root')
if (!root) throw new Error('Missing fixture root')
createRoot(root).render(
  <StrictMode>
    <Fixture />
  </StrictMode>
)
