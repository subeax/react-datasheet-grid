import React from 'react'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { DataSheetGrid, DataSheetGridRef, keyColumn, textColumn } from '../src'

jest.mock('react-resize-detector', () => ({
  useResizeDetector: () => ({ width: 500, height: 300 }),
}))

const columns = [keyColumn('value', textColumn)]

it.each([
  [
    { 'text/plain': '42', 'text/html': '<table><tr><td>999</td></tr></table>' },
    '42',
  ],
  [{ 'text/html': '<table><tr><td>17</td></tr></table>' }, '17'],
])(
  'prefers plain text with an HTML fallback: %j',
  async (formats, expected) => {
    const ref = React.createRef<DataSheetGridRef>()
    const onChange = jest.fn()
    render(
      <DataSheetGrid
        ref={ref}
        value={[{ value: '' }]}
        columns={columns}
        onChange={onChange}
      />
    )
    act(() => ref.current?.setActiveCell({ row: 0, col: 0 }))
    const data = formats as Record<string, string>
    fireEvent.paste(document, {
      clipboardData: {
        types: Object.keys(data),
        getData: (format: string) => data[format] ?? '',
      },
    })
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        [{ value: expected }],
        [{ type: 'UPDATE', fromRowIndex: 0, toRowIndex: 1 }]
      )
    )
  }
)
