export type ResizableColumn = {
  id?: string
  minWidth: number
  maxWidth?: number
}

export function resizeBounds(column: ResizableColumn): {
  min: number
  max: number
} {
  const min = Number.isFinite(column.minWidth)
    ? Math.max(1, column.minWidth)
    : 1
  const max =
    column.maxWidth !== undefined && Number.isFinite(column.maxWidth)
      ? Math.max(min, column.maxWidth)
      : Infinity
  return { min, max }
}

export function clampColumnWidth(
  width: number,
  column: ResizableColumn
): number {
  const { min, max } = resizeBounds(column)
  return Math.min(max, Math.max(min, width))
}

/** Ignore unknown/non-finite entries; never read inherited properties as widths. */
export function resizedColumnWidth(
  column: ResizableColumn,
  widths: Record<string, number>
): number | undefined {
  if (!column.id || !Object.prototype.hasOwnProperty.call(widths, column.id))
    return undefined
  const value = widths[column.id]
  return typeof value === 'number' && Number.isFinite(value)
    ? clampColumnWidth(value, column)
    : undefined
}

export function sanitizeColumnWidths(
  columns: ResizableColumn[],
  widths: Record<string, number>
): Record<string, number> {
  return Object.fromEntries(
    columns.flatMap((column) => {
      const value = resizedColumnWidth(column, widths)
      return column.id && value !== undefined ? [[column.id, value]] : []
    })
  )
}
