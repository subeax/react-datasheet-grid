import React, { useEffect, useLayoutEffect, useRef } from 'react'
import { ColumnResizeControls } from '../hooks/useColumnResizing'
import { clampColumnWidth, resizeBounds } from '../utils/columnResizing'

type Props = {
  columnId: string
  width: number
  minWidth: number
  maxWidth?: number
  controls: ColumnResizeControls
}

/** Owns only this pointer gesture; never replaces document handlers belonging to another grid. */
export function ColumnResizeHandle({
  columnId,
  width,
  minWidth,
  maxWidth,
  controls,
}: Props): React.JSX.Element {
  const latest = useRef(controls)
  const cancelGesture = useRef<(() => void) | null>(null)
  useLayoutEffect(() => {
    latest.current = controls
  }, [controls])
  useEffect(
    () => () => cancelGesture.current?.(),
    [columnId, minWidth, maxWidth]
  )
  const bounds = resizeBounds({ minWidth, maxWidth })

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      event.button !== 0 ||
      event.isPrimary === false ||
      cancelGesture.current
    )
      return
    // Keep the compatibility mousedown: other grids use it to release their
    // active cell. Prevent its browser default below, not the pointer event.
    event.stopPropagation()
    const element = event.currentTarget
    const doc = element.ownerDocument
    const win = doc.defaultView
    const pointerId = event.pointerId
    const startX = event.clientX
    const startWidth = width
    latest.current.start(columnId, width)

    const update = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return
      latest.current.update(
        clampColumnWidth(startWidth + next.clientX - startX, {
          minWidth,
          maxWidth,
        })
      )
    }
    const finish = (cancelled: boolean) => {
      if (!cancelGesture.current) return
      cancelGesture.current = null
      doc.removeEventListener('pointermove', update)
      doc.removeEventListener('pointerup', up)
      doc.removeEventListener('pointercancel', cancelPointer)
      doc.removeEventListener('keydown', keyDown, true)
      element.removeEventListener('lostpointercapture', cancelPointer)
      win?.removeEventListener('blur', cancel)
      if (element.hasPointerCapture?.(pointerId))
        element.releasePointerCapture(pointerId)
      if (cancelled) latest.current.cancel()
      else latest.current.commit()
    }
    const up = (next: PointerEvent) => {
      if (next.pointerId !== pointerId) return
      update(next)
      finish(false)
    }
    const cancel = () => finish(true)
    const cancelPointer = (next: PointerEvent) => {
      if (next.pointerId === pointerId) cancel()
    }
    const keyDown = (next: KeyboardEvent) => {
      if (next.key === 'Escape') {
        next.preventDefault()
        next.stopImmediatePropagation()
        cancel()
      }
    }
    cancelGesture.current = cancel
    doc.addEventListener('pointermove', update)
    doc.addEventListener('pointerup', up)
    doc.addEventListener('pointercancel', cancelPointer)
    doc.addEventListener('keydown', keyDown, true)
    element.addEventListener('lostpointercapture', cancelPointer)
    win?.addEventListener('blur', cancel)
    element.setPointerCapture?.(pointerId)
  }

  return (
    <div
      className="dsg-resize-handle"
      role="separator"
      aria-label={`Resize column ${columnId}`}
      aria-orientation="vertical"
      aria-valuenow={width}
      aria-valuemin={bounds.min}
      aria-valuemax={Number.isFinite(bounds.max) ? bounds.max : undefined}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onMouseDown={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        // Native Tab navigation is allowed, but must not reach the grid's keyboard handler.
        event.stopPropagation()
        const step = event.shiftKey ? 50 : 10
        const next =
          event.key === 'ArrowLeft'
            ? width - step
            : event.key === 'ArrowRight'
            ? width + step
            : event.key === 'Home'
            ? bounds.min
            : event.key === 'End' && Number.isFinite(bounds.max)
            ? bounds.max
            : null
        if (next === null || cancelGesture.current) return
        event.preventDefault()
        latest.current.start(columnId, width)
        latest.current.update(clampColumnWidth(next, { minWidth, maxWidth }))
        latest.current.commit()
      }}
    />
  )
}
