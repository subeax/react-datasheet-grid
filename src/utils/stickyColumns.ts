/** The count excludes the gutter and optional sticky-right action column. */
export function normalizeStickyColumnCount(
  value: number,
  dataColumns: number
): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(Math.floor(value), dataColumns))
    : 0
}

export function getStickyLeftWidth(
  widths: readonly number[],
  count: number
): number {
  // columnRights ends in an Infinity sentinel, so it cannot give the width
  // when every data column is frozen (or the grid only contains the gutter).
  return widths.slice(0, count + 1).reduce((total, width) => total + width, 0)
}

export type HorizontalSlice = { left: number; width: number; sticky: boolean }

/** Project one logical range into the frozen and scrolling panes, in content coordinates. */
export function splitStickyRange({
  left,
  width,
  firstColumn,
  lastColumn,
  stickyColumns,
  stickyWidth,
  scrollLeft,
  viewportRight,
}: {
  left: number
  width: number
  firstColumn: number
  lastColumn: number
  stickyColumns: number
  stickyWidth: number
  scrollLeft: number
  viewportRight: number
}): HorizontalSlice[] {
  if (stickyColumns === 0) {
    return [{ left, width, sticky: false }]
  }
  const slices: HorizontalSlice[] = []
  const right = left + width
  if (firstColumn < stickyColumns) {
    const frozenRight = lastColumn < stickyColumns ? right : stickyWidth
    const visibleRight = Math.min(frozenRight + scrollLeft, viewportRight)
    const frozenLeft = left + scrollLeft
    if (visibleRight > frozenLeft) {
      slices.push({
        left: frozenLeft,
        width: visibleRight - frozenLeft,
        sticky: true,
      })
    }
  }
  if (lastColumn >= stickyColumns) {
    const visibleLeft = Math.max(left, stickyWidth + scrollLeft)
    const visibleRight = Math.min(right, viewportRight)
    if (visibleRight > visibleLeft) {
      slices.push({
        left: visibleLeft,
        width: visibleRight - visibleLeft,
        sticky: false,
      })
    }
  }
  return slices
}
