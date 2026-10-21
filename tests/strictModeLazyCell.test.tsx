import React from 'react'
import { act, render } from '@testing-library/react'
import {
  createTextColumn,
  DataSheetGrid,
  DataSheetGridRef,
  keyColumn,
} from '../src'

jest.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ width: 500, height: 300 }),
}))

it('does not commit rounded display values on StrictMode mount or untouched blur', () => {
  const onChange = jest.fn()
  const ref = React.createRef<DataSheetGridRef>()
  const columns = [
    keyColumn(
      'value',
      createTextColumn<number>({
        continuousUpdates: false,
        formatBlurredInput: (value) => value.toFixed(1),
        parseUserInput: Number,
      })
    ),
  ]
  render(
    <React.StrictMode>
      <DataSheetGrid
        ref={ref}
        columns={columns}
        value={[{ value: 1.2345 }]}
        onChange={onChange}
      />
    </React.StrictMode>
  )
  expect(onChange).not.toHaveBeenCalled()
  act(() => ref.current?.setActiveCell({ row: 0, col: 0 }))
  act(() => ref.current?.setActiveCell(null))
  expect(onChange).not.toHaveBeenCalled()
})
