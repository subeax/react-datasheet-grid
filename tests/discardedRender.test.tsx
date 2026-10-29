import React, { startTransition, Suspense } from 'react'
import { act, render } from '@testing-library/react'
import { DataSheetGrid, keyColumn, textColumn } from '../src'

jest.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ width: 500, height: 300 }),
}))

const never = new Promise<never>(() => undefined)
const Suspend = (): React.ReactElement => {
  throw never
}

const App = ({ show }: { show: boolean }) => (
  <Suspense fallback={null}>
    {show && (
      <DataSheetGrid
        columns={[keyColumn('value', textColumn)]}
        value={[{ value: 'a' }]}
      />
    )}
    {show && <Suspend />}
  </Suspense>
)

afterEach(() => {
  jest.useRealTimers()
  jest.restoreAllMocks()
})

it('does not schedule state updates from a render React discards', () => {
  jest.useFakeTimers()
  const error = jest.spyOn(console, 'error').mockImplementation(() => undefined)
  const { rerender } = render(<App show={false} />)

  // The sibling suspends inside a transition, so React keeps the old UI and
  // throws away the grid it already rendered.
  act(() => {
    startTransition(() => rerender(<App show />))
  })
  act(() => {
    jest.advanceTimersByTime(200)
  })

  const messages = error.mock.calls.map((args) => String(args[0]))
  expect(
    messages.filter((message) => message.includes("hasn't mounted"))
  ).toEqual([])
})
