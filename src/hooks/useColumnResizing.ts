import { useLayoutEffect, useRef, useState } from 'react'
import { ResizableColumn, sanitizeColumnWidths } from '../utils/columnResizing'

export type ColumnResizeControls = {
  start: (id: string, width: number) => void
  update: (width: number) => void
  commit: () => void
  cancel: () => void
}

type Session = {
  id: string
  initialWidth: number
  width: number
  before: Record<string, number>
}

/** Width edits are independent of row data. A drag is one transaction and can be cancelled. */
export function useColumnResizing({
  columns,
  initialColumnWidths = {},
  onColumnsResize,
  onColumnsResizing,
}: {
  columns: ResizableColumn[]
  initialColumnWidths?: Record<string, number>
  onColumnsResize?: (widths: Record<string, number>) => void
  onColumnsResizing?: (widths: Record<string, number>) => void
}) {
  const [widths, setWidths] = useState(() =>
    sanitizeColumnWidths(columns, initialColumnWidths)
  )
  const widthsRef = useRef(widths)
  const session = useRef<Session | null>(null)
  const resizing = useRef(false)
  const latest = useRef({ columns, onColumnsResize, onColumnsResizing })
  useLayoutEffect(() => {
    latest.current = { columns, onColumnsResize, onColumnsResizing }
  }, [columns, onColumnsResize, onColumnsResizing])

  const apply = (next: Record<string, number>) => {
    widthsRef.current = next
    setWidths(next)
    latest.current.onColumnsResizing?.({ ...next })
  }
  const controls: ColumnResizeControls = {
    start: (id, width) => {
      session.current = {
        id,
        initialWidth: width,
        width,
        before: widthsRef.current,
      }
      resizing.current = true
    },
    update: (width) => {
      const drag = session.current
      if (!drag || drag.width === width) return
      drag.width = width
      apply(
        sanitizeColumnWidths(latest.current.columns, {
          ...drag.before,
          [drag.id]: width,
        })
      )
    },
    commit: () => {
      const drag = session.current
      session.current = null
      resizing.current = false
      if (!drag) return
      if (drag.width === drag.initialWidth) {
        // Returning to the start must not turn a flexible column into a fixed one.
        if (widthsRef.current !== drag.before) apply(drag.before)
      } else {
        latest.current.onColumnsResize?.({ ...widthsRef.current })
      }
    },
    cancel: () => {
      const drag = session.current
      session.current = null
      resizing.current = false
      if (drag && widthsRef.current !== drag.before) apply(drag.before)
    },
  }
  return { widths, controls, resizing }
}
