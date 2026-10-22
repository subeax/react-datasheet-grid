import React from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, renderHook } from '@testing-library/react'
import { ColumnResizeHandle } from '../src/components/ColumnResizeHandle'
import { useColumnResizing } from '../src/hooks/useColumnResizing'
import { getColumnWidths } from '../src/hooks/useColumnWidths'
import { sanitizeColumnWidths } from '../src/utils/columnResizing'

const a = {
  id: 'a',
  basis: 100,
  minWidth: 60,
  maxWidth: 220,
  grow: 1,
  shrink: 1,
}
const b = { id: 'b', basis: 100, minWidth: 60, grow: 1, shrink: 1 }
const columns = [a, b]

it('fixes resized widths and distributes remaining space to untouched flexible columns', () => {
  expect(getColumnWidths(500, columns, { a: 180 })).toEqual([180, 320])
  expect(getColumnWidths(500, [b, a], { a: 180 })).toEqual([320, 180])
  expect(getColumnWidths(500, columns, { a: 180, b: 120 })).toEqual([180, 120])
})

it('clamps initial widths and ignores invalid and unknown overrides', () => {
  expect(
    sanitizeColumnWidths(columns, { a: 500, b: -100, unknown: 200 })
  ).toEqual({ a: 220, b: 60 })
  expect(sanitizeColumnWidths(columns, { a: NaN, b: Infinity })).toEqual({})
  expect(getColumnWidths(500, columns, { a: 500 })).toEqual([220, 280])
  expect(getColumnWidths(500, columns, { a: -100 })).toEqual([60, 440])
  expect(
    getColumnWidths(500, [a, { ...b, minWidth: 400 }], { a: 180 })
  ).toEqual([180, 400])
})

it('does not mistake inherited properties for overrides and supports unusual column IDs', () => {
  const inherited = Object.create({ a: 200 }) as Record<string, number>
  expect(sanitizeColumnWidths(columns, inherited)).toEqual({})
  const widths = JSON.parse('{"__proto__":100}') as Record<string, number>
  const sanitized = sanitizeColumnWidths([{ ...a, id: '__proto__' }], widths)
  expect(Object.prototype.hasOwnProperty.call(sanitized, '__proto__')).toBe(
    true
  )
  expect(sanitized['__proto__']).toBe(100)
})

it('commits one resize transaction, preserves other overrides, and isolates callback data', () => {
  const onColumnsResize = jest.fn()
  const onColumnsResizing = jest.fn((widths) => {
    widths.a = 999
  })
  const initial = { b: 140 }
  const { result } = renderHook(() =>
    useColumnResizing({
      columns,
      initialColumnWidths: initial,
      onColumnsResize,
      onColumnsResizing,
    })
  )
  act(() => {
    result.current.controls.start('a', 200)
    result.current.controls.update(160)
    result.current.controls.update(180)
  })
  expect(result.current.widths).toEqual({ a: 180, b: 140 })
  expect(initial).toEqual({ b: 140 })
  expect(onColumnsResize).not.toHaveBeenCalled()
  act(() => result.current.controls.commit())
  expect(onColumnsResize).toHaveBeenCalledTimes(1)
  expect(onColumnsResize).toHaveBeenCalledWith({ a: 180, b: 140 })
  expect(result.current.resizing.current).toBe(false)
})

it('cancels without freezing an originally flexible column or committing a callback', () => {
  const onColumnsResize = jest.fn()
  const onColumnsResizing = jest.fn()
  const { result } = renderHook(() =>
    useColumnResizing({ columns, onColumnsResize, onColumnsResizing })
  )
  act(() => {
    result.current.controls.start('a', 200)
    result.current.controls.update(180)
    result.current.controls.cancel()
  })
  expect(result.current.widths).toEqual({})
  expect(onColumnsResizing).toHaveBeenLastCalledWith({})
  expect(onColumnsResize).not.toHaveBeenCalled()
})

it('treats a drag back to the original width as a no-op and uses the latest callback', () => {
  const first = jest.fn()
  const second = jest.fn()
  const { result, rerender } = renderHook(
    ({ callback }) => useColumnResizing({ columns, onColumnsResize: callback }),
    { initialProps: { callback: first } }
  )
  act(() => {
    result.current.controls.start('a', 200)
    result.current.controls.update(180)
    result.current.controls.update(200)
    result.current.controls.commit()
  })
  expect(result.current.widths).toEqual({})
  expect(first).not.toHaveBeenCalled()
  act(() => {
    result.current.controls.start('a', 200)
    result.current.controls.update(190)
  })
  rerender({ callback: second })
  act(() => result.current.controls.commit())
  expect(first).not.toHaveBeenCalled()
  expect(second).toHaveBeenCalledWith({ a: 190 })
})

const originalPointerEvent = window.PointerEvent
class TestPointerEvent extends MouseEvent {
  pointerId: number
  isPrimary: boolean
  constructor(type: string, options: PointerEventInit = {}) {
    super(type, options)
    this.pointerId = options.pointerId ?? 1
    this.isPrimary = options.isPrimary ?? true
  }
}
beforeEach(() => {
  window.PointerEvent = TestPointerEvent as typeof PointerEvent
})
afterEach(() => {
  window.PointerEvent = originalPointerEvent
})
const pointer = (clientX: number, pointerId = 1) => ({
  clientX,
  pointerId,
  button: 0,
  bubbles: true,
})
const controls = () => ({
  start: jest.fn(),
  update: jest.fn(),
  commit: jest.fn(),
  cancel: jest.fn(),
})

it('resizes only the captured pointer, clamps limits, and does not replace document handlers', () => {
  const callbacks = controls()
  const externalUp = jest.fn()
  const previous = document.onpointerup
  document.onpointerup = externalUp
  try {
    const { getByRole } = render(
      <ColumnResizeHandle
        columnId="a"
        width={100}
        minWidth={60}
        maxWidth={220}
        controls={callbacks}
      />
    )
    fireEvent.pointerDown(getByRole('separator'), pointer(100))
    fireEvent.pointerMove(document, pointer(170, 2))
    expect(callbacks.update).not.toHaveBeenCalled()
    fireEvent.pointerMove(document, pointer(1000))
    expect(callbacks.update).toHaveBeenLastCalledWith(220)
    fireEvent.pointerUp(document, pointer(-200))
    expect(callbacks.update).toHaveBeenLastCalledWith(60)
    expect(callbacks.commit).toHaveBeenCalledTimes(1)
    expect(document.onpointerup).toBe(externalUp)
    const calls = callbacks.update.mock.calls.length
    fireEvent.pointerMove(document, pointer(180))
    expect(callbacks.update).toHaveBeenCalledTimes(calls)
  } finally {
    document.onpointerup = previous
  }
})

it.each(['escape', 'pointercancel', 'blur', 'unmount'])(
  'cleans up and cancels on %s',
  (reason) => {
    const callbacks = controls()
    const view = render(
      <ColumnResizeHandle
        columnId="a"
        width={100}
        minWidth={60}
        controls={callbacks}
      />
    )
    fireEvent.pointerDown(view.getByRole('separator'), pointer(100))
    if (reason === 'escape') fireEvent.keyDown(document, { key: 'Escape' })
    if (reason === 'pointercancel')
      fireEvent.pointerCancel(document, pointer(120))
    if (reason === 'blur') fireEvent(window, new Event('blur'))
    if (reason === 'unmount') view.unmount()
    expect(callbacks.cancel).toHaveBeenCalledTimes(1)
    fireEvent.pointerMove(document, pointer(200))
    fireEvent.pointerUp(document, pointer(200))
    expect(callbacks.update).not.toHaveBeenCalled()
    expect(callbacks.commit).not.toHaveBeenCalled()
  }
)

it('supports keyboard resizing and leaves Tab navigation to the browser', () => {
  const callbacks = controls()
  const { getByRole } = render(
    <ColumnResizeHandle
      columnId="a"
      width={100}
      minWidth={60}
      maxWidth={220}
      controls={callbacks}
    />
  )
  const handle = getByRole('separator', { name: 'Resize column a' })
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(callbacks.update).toHaveBeenLastCalledWith(110)
  fireEvent.keyDown(handle, { key: 'End' })
  expect(callbacks.update).toHaveBeenLastCalledWith(220)
  fireEvent.keyDown(handle, { key: 'Home' })
  expect(callbacks.update).toHaveBeenLastCalledWith(60)
  expect(fireEvent.keyDown(handle, { key: 'Tab' })).toBe(true)
  expect(callbacks.commit).toHaveBeenCalledTimes(3)
})
