import React, { useState } from 'react'
import '@testing-library/jest-dom'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import {
  DataSheetGrid,
  DynamicDataSheetGrid,
  DataSheetGridRef,
  keyColumn,
  textColumn,
} from '../src'
import {
  normalizeStickyColumnCount,
  splitStickyRange,
} from '../src/utils/stickyColumns'

jest.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ width: 500, height: 160 }),
}))

type Row = Record<string, string | null>
const fields = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
const columns = fields.map((field) => ({
  ...keyColumn<Row>(field, textColumn),
  title: field,
  basis: 100,
  grow: 0,
  shrink: 0,
}))
const initial: Row[] = Array.from({ length: 3 }, (_, row) =>
  Object.fromEntries(fields.map((field) => [field, `${field}${row}`]))
)

beforeEach(() => {
  jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(500)
  jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(160)
  jest
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: HTMLElement) {
      const inner = this.parentElement?.classList.contains('dsg-container')
      const left = inner ? -(this.parentElement?.scrollLeft ?? 0) : 0
      return {
        x: left,
        y: 0,
        left,
        top: 0,
        right: left + 500,
        bottom: 160,
        width: 500,
        height: 160,
        toJSON: () => ({}),
      }
    })
})
afterEach(() => jest.restoreAllMocks())

function setup(stickyLeftColumnNumber = 2) {
  const ref = React.createRef<DataSheetGridRef>()
  const change = jest.fn()
  function Sheet() {
    const [data, setData] = useState(initial)
    return (
      <DynamicDataSheetGrid
        ref={ref}
        value={data}
        columns={columns}
        stickyLeftColumnNumber={stickyLeftColumnNumber}
        lockRows
        onChange={(next, operations) => {
          change(next, operations)
          setData(next)
        }}
      />
    )
  }
  const view = render(<Sheet />)
  const viewport =
    view.container.querySelector<HTMLDivElement>('.dsg-container')
  if (!viewport) throw new Error('Missing grid viewport')
  const scroll = (left: number) => {
    viewport.scrollLeft = left
    fireEvent.scroll(viewport)
  }
  return { ...view, ref, change, viewport, scroll }
}

it.each([
  [-1, 3, 0],
  [2.9, 3, 2],
  [20, 3, 3],
  [NaN, 3, 0],
  [Infinity, 3, 0],
  [2, 0, 0],
])(
  'normalizes sticky count %s for %s data columns',
  (value, count, expected) => {
    expect(normalizeStickyColumnCount(value, count)).toBe(expected)
  }
)

it('projects a selection spanning frozen and scrolling columns without drawing under the frozen pane', () => {
  expect(
    splitStickyRange({
      left: 40,
      width: 601,
      firstColumn: 0,
      lastColumn: 5,
      stickyColumns: 2,
      stickyWidth: 240,
      scrollLeft: 300,
      viewportRight: 800,
    })
  ).toEqual([
    { left: 340, width: 200, sticky: true },
    { left: 540, width: 101, sticky: false },
  ])
  expect(
    splitStickyRange({
      left: 240,
      width: 101,
      firstColumn: 2,
      lastColumn: 2,
      stickyColumns: 2,
      stickyWidth: 240,
      scrollLeft: 300,
      viewportRight: 800,
    })
  ).toEqual([])
})

it('clips overlays before a sticky-right column and preserves unpinned geometry', () => {
  expect(
    splitStickyRange({
      left: 40,
      width: 801,
      firstColumn: 0,
      lastColumn: 7,
      stickyColumns: 2,
      stickyWidth: 240,
      scrollLeft: 300,
      viewportRight: 750,
    })
  ).toEqual([
    { left: 340, width: 200, sticky: true },
    { left: 540, width: 210, sticky: false },
  ])
  expect(
    splitStickyRange({
      left: 40,
      width: 101,
      firstColumn: 0,
      lastColumn: 0,
      stickyColumns: 0,
      stickyWidth: 40,
      scrollLeft: 300,
      viewportRight: 750,
    })
  ).toEqual([{ left: 40, width: 101, sticky: false }])
})

it('keeps frozen headers in order after they leave the horizontal virtual range', async () => {
  const { container, scroll } = setup()
  scroll(500)
  await waitFor(() =>
    expect(
      Array.from(
        container.querySelectorAll('.dsg-row-header .dsg-cell-sticky-left')
      ).map((cell) => cell.textContent)
    ).toEqual(['a', 'b'])
  )
  const row = container.querySelector('.dsg-row:not(.dsg-row-header)')
  expect(row?.querySelector('.dsg-cell-gutter')).toBeVisible()
  expect(
    Array.from(
      row?.querySelectorAll<HTMLInputElement>('.dsg-cell-sticky-left input') ??
        []
    ).map((input) => input.value)
  ).toEqual(['a0', 'b0'])
})

it('clicking the gutter after scrolling still selects the whole row, not the first pinned cell', async () => {
  const { container, scroll, ref } = setup()
  scroll(300)
  const gutter = await waitFor(() => {
    const cell = container.querySelector(
      '.dsg-row:not(.dsg-row-header) .dsg-cell-gutter'
    )
    expect(cell).not.toBeNull()
    return cell as Element
  })
  fireEvent.mouseDown(gutter, { clientX: 20, clientY: 60 })
  fireEvent.mouseUp(document)
  expect(ref.current?.selection).toMatchObject({
    min: { col: 0, row: 0 },
    max: { col: 7, row: 0 },
  })
})

it('hit-tests a pinned cell and its range drag in viewport coordinates', async () => {
  const { container, scroll, ref } = setup()
  scroll(300)
  const cells = await waitFor(() => {
    const nodes = container.querySelectorAll(
      '.dsg-row:not(.dsg-row-header) .dsg-cell-sticky-left'
    )
    expect(nodes.length).toBeGreaterThanOrEqual(2)
    return nodes
  })
  fireEvent.mouseDown(cells[1], { clientX: 180, clientY: 60 })
  fireEvent.mouseMove(document, { clientX: 80, clientY: 100 })
  fireEvent.mouseUp(document)
  expect(ref.current?.selection).toMatchObject({
    min: { col: 0, row: 0 },
    max: { col: 1, row: 1 },
  })
})

it('keeps a pinned active cell and fill handle aligned without scrolling back to the start', () => {
  const { container, scroll, ref, viewport } = setup()
  scroll(300)
  act(() => ref.current?.setActiveCell({ row: 0, col: 0 }))
  expect(viewport.scrollLeft).toBe(300)
  expect(container.querySelector('.dsg-active-cell')).toHaveStyle({
    left: '340px',
  })
  expect(container.querySelector('.dsg-expand-rows-indicator')).toHaveStyle({
    left: '440px',
  })
  scroll(400)
  expect(container.querySelector('.dsg-active-cell')).toHaveStyle({
    left: '440px',
  })
  expect(container.querySelector('.dsg-expand-rows-indicator')).toHaveStyle({
    left: '540px',
  })
})

it('scrolls unpinned cells into the space after ALL frozen columns', () => {
  const { scroll, ref, viewport } = setup()
  scroll(300)
  act(() => ref.current?.setActiveCell({ row: 0, col: 4 }))
  expect(viewport.scrollLeft).toBe(200)
  fireEvent.keyDown(document, { key: 'ArrowLeft' })
  expect(ref.current?.activeCell?.col).toBe(3)
  expect(viewport.scrollLeft).toBe(100)
})

it('copies, pastes and deletes a range across the frozen boundary as a single update', async () => {
  const { ref, change } = setup()
  act(() =>
    ref.current?.setSelection({
      min: { row: 0, col: 1 },
      max: { row: 0, col: 2 },
    })
  )
  const setData = jest.fn()
  fireEvent.copy(document, { clipboardData: { setData } })
  expect(setData).toHaveBeenCalledWith('text/plain', 'b0\tc0')
  fireEvent.paste(document, {
    clipboardData: { types: ['text/plain'], getData: () => '11\t12' },
  })
  await waitFor(() =>
    expect(change).toHaveBeenLastCalledWith(
      [{ ...initial[0], b: '11', c: '12' }, initial[1], initial[2]],
      [{ type: 'UPDATE', fromRowIndex: 0, toRowIndex: 1 }]
    )
  )
  fireEvent.keyDown(document, { key: 'Delete' })
  expect(change).toHaveBeenLastCalledWith(
    [{ ...initial[0], b: null, c: null }, initial[1], initial[2]],
    [{ type: 'UPDATE', fromRowIndex: 0, toRowIndex: 1 }]
  )
})

it('fills only the selected pinned column after scrolling', async () => {
  const { container, scroll, ref, change, viewport } = setup()
  scroll(300)
  act(() => ref.current?.setActiveCell({ row: 0, col: 0 }))
  const handle = container.querySelector('.dsg-expand-rows-indicator')
  if (!handle) throw new Error('Missing fill handle')
  fireEvent.mouseDown(handle, { clientX: 140, clientY: 80 })
  fireEvent.mouseMove(document, { clientX: 140, clientY: 140 })
  fireEvent.mouseUp(document)
  await waitFor(() =>
    expect(change).toHaveBeenLastCalledWith(
      [initial[0], { ...initial[1], a: 'a0' }, { ...initial[2], a: 'a0' }],
      [{ type: 'UPDATE', fromRowIndex: 1, toRowIndex: 3 }]
    )
  )
  expect(viewport.scrollLeft).toBe(300)
})

it('supports all data columns, a hidden gutter, and a sticky-right column without counting it as data', async () => {
  const view = render(
    <DataSheetGrid
      value={initial}
      columns={columns}
      gutterColumn={false}
      stickyLeftColumnNumber={100}
      stickyRightColumn={{ title: 'Actions' }}
    />
  )
  await waitFor(() =>
    expect(
      Array.from(
        view.container.querySelectorAll('.dsg-row-header .dsg-cell-sticky-left')
      ).map((cell) => cell.textContent)
    ).toEqual(fields)
  )
  expect(
    view.container.querySelector('.dsg-row-header .dsg-cell-sticky-right')
  ).toHaveTextContent('Actions')
})

it('uses a finite frozen width when every column is pinned or only the gutter exists', () => {
  const view = render(
    <DataSheetGrid
      value={initial}
      columns={columns}
      stickyLeftColumnNumber={100}
    />
  )
  expect(view.container.querySelector('.dsg-scrollable-view')).toHaveStyle({
    left: '840px',
    width: '0px',
  })
  view.unmount()
  const empty = render(
    <DataSheetGrid value={[]} columns={[]} stickyLeftColumnNumber={2} />
  )
  expect(empty.container.querySelector('.dsg-scrollable-view')).toHaveStyle({
    left: '40px',
  })
})

it('can toggle the numeric prop without remounting even in the static grid', () => {
  const view = render(
    <DataSheetGrid
      value={initial}
      columns={columns}
      stickyLeftColumnNumber={2}
    />
  )
  view.rerender(
    <DataSheetGrid
      value={initial}
      columns={columns}
      stickyLeftColumnNumber={0}
    />
  )
  expect(view.container.querySelector('.dsg-cell-sticky-left')).toBeNull()
  expect(view.container.querySelector('.dsg-row-sticky-left')).toBeNull()
})
