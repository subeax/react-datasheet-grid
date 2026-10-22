import React, { useEffect, useMemo, useState } from 'react'
import cx from 'classnames'
import { SelectionContextType } from '../types'
import { getStickyLeftWidth, splitStickyRange } from '../utils/stickyColumns'

type Rect = { left: number; top: number; width: number; height: number }

const buildSquare = (
  top: number | string,
  right: number | string,
  bottom: number | string,
  left: number | string
) => {
  return [
    [left, top],
    [right, top],
    [right, bottom],
    [left, bottom],
    [left, top],
  ]
}

const buildClipPath = (
  top: number,
  right: number,
  bottom: number,
  left: number
) => {
  const values = [
    ...buildSquare(0, '100%', '100%', 0),
    ...buildSquare(top, right, bottom, left),
  ]

  return `polygon(evenodd, ${values
    .map((pair) =>
      pair
        .map((value) =>
          typeof value === 'number' && value !== 0 ? value + 'px' : value
        )
        .join(' ')
    )
    .join(',')})`
}

export const SelectionRect = React.memo<SelectionContextType>(
  ({
    columnWidths,
    columnRights,
    headerRowHeight,
    selection,
    rowHeight,
    activeCell,
    hasStickyRightColumn,
    stickyLeftColumnNumber,
    outerRef,
    dataLength,
    viewWidth,
    viewHeight,
    contentWidth,
    edges,
    isCellDisabled,
    editing,
    expandSelection,
  }) => {
    // Only overlays need to rerender with horizontal scroll. The cells stay pinned
    // by CSS, and consumers' onScroll callbacks remain untouched.
    const [scrollOffset, setScrollOffset] = useState(0)
    useEffect(() => {
      const element = outerRef.current
      if (!element || stickyLeftColumnNumber === 0) return
      const update = () => setScrollOffset(element.scrollLeft)
      update()
      element.addEventListener('scroll', update)
      return () => element.removeEventListener('scroll', update)
    }, [outerRef, stickyLeftColumnNumber])
    const scrollLeft = stickyLeftColumnNumber > 0 ? scrollOffset : 0
    const activeCellIsDisabled = activeCell ? isCellDisabled(activeCell) : false

    const selectionIsDisabled = useMemo(() => {
      if (!selection) {
        return activeCellIsDisabled
      }

      for (let col = selection.min.col; col <= selection.max.col; ++col) {
        for (let row = selection.min.row; row <= selection.max.row; ++row) {
          if (!isCellDisabled({ col, row })) {
            return false
          }
        }
      }

      return true
    }, [activeCellIsDisabled, isCellDisabled, selection])

    if (!columnWidths || !columnRights) {
      return null
    }

    const stickyLeftWidth = getStickyLeftWidth(
      columnWidths,
      stickyLeftColumnNumber
    )
    const viewportRight =
      scrollLeft +
      Math.min(viewWidth ?? Infinity, contentWidth ?? Infinity) -
      (hasStickyRightColumn ? columnWidths[columnWidths.length - 1] : 0)
    const project = (
      rect: Rect | null | false,
      firstColumn: number,
      lastColumn: number
    ) =>
      rect
        ? splitStickyRange({
            ...rect,
            firstColumn,
            lastColumn,
            stickyColumns: stickyLeftColumnNumber,
            stickyWidth: stickyLeftWidth,
            scrollLeft,
            viewportRight,
          }).map(({ left, width, sticky }) => ({
            rect: { ...rect, left, width },
            sticky,
          }))
        : []

    const extraPixelV = (rowI: number): number => {
      return rowI < dataLength - 1 ? 1 : 0
    }

    const extraPixelH = (colI: number): number => {
      return colI < columnWidths.length - (hasStickyRightColumn ? 3 : 2) ? 1 : 0
    }

    const activeCellRect = activeCell && {
      width: columnWidths[activeCell.col + 1] + extraPixelH(activeCell.col),
      height: rowHeight(activeCell.row).height + extraPixelV(activeCell.row),
      left: columnRights[activeCell.col],
      top: rowHeight(activeCell.row).top + headerRowHeight,
    }

    const selectionRect = selection && {
      width:
        columnWidths
          .slice(selection.min.col + 1, selection.max.col + 2)
          .reduce((a, b) => a + b) + extraPixelH(selection.max.col),
      height:
        rowHeight(selection.max.row).top +
        rowHeight(selection.max.row).height -
        rowHeight(selection.min.row).top +
        extraPixelV(selection.max.row),
      left: columnRights[selection.min.col],
      top: rowHeight(selection.min.row).top + headerRowHeight,
    }

    const minSelection = selection?.min || activeCell
    const maxSelection = selection?.max || activeCell

    const expandRowsIndicator = maxSelection &&
      expandSelection !== null && {
        left:
          columnRights[maxSelection.col] + columnWidths[maxSelection.col + 1],
        top:
          rowHeight(maxSelection.row).top +
          rowHeight(maxSelection.row).height +
          headerRowHeight,
        transform: `translate(-${
          maxSelection.col <
          columnWidths.length - (hasStickyRightColumn ? 3 : 2)
            ? 50
            : 100
        }%, -${maxSelection.row < dataLength - 1 ? 50 : 100}%)`,
      }

    const expandRowsRect = minSelection &&
      maxSelection &&
      expandSelection !== null && {
        width:
          columnWidths
            .slice(minSelection.col + 1, maxSelection.col + 2)
            .reduce((a, b) => a + b) + extraPixelH(maxSelection.col),
        height:
          rowHeight(maxSelection.row + expandSelection).top +
          rowHeight(maxSelection.row + expandSelection).height -
          rowHeight(maxSelection.row + 1).top +
          extraPixelV(maxSelection.row + expandSelection) -
          1,
        left: columnRights[minSelection.col],
        top:
          rowHeight(maxSelection.row).top +
          rowHeight(maxSelection.row).height +
          headerRowHeight +
          1,
      }

    const activeRects = project(
      activeCellRect,
      activeCell?.col ?? 0,
      activeCell?.col ?? 0
    )
    const selectionRects = project(
      selectionRect,
      selection?.min.col ?? 0,
      selection?.max.col ?? 0
    )
    const expandRects = project(
      expandRowsRect,
      minSelection?.col ?? 0,
      maxSelection?.col ?? 0
    )
    const markerRects = selectionRect ? selectionRects : activeRects
    const indicatorSticky =
      (maxSelection?.col ?? Infinity) < stickyLeftColumnNumber
    const indicatorLeft = expandRowsIndicator
      ? expandRowsIndicator.left + (indicatorSticky ? scrollLeft : 0)
      : 0
    const indicatorVisible =
      stickyLeftColumnNumber === 0 ||
      (indicatorLeft <= viewportRight &&
        (indicatorSticky || indicatorLeft > scrollLeft + stickyLeftWidth))
    const overlayClass =
      stickyLeftColumnNumber > 0 ? 'dsg-sticky-range-overlay' : undefined

    return (
      <>
        <div
          className="dsg-scrollable-view-container"
          style={{
            height:
              rowHeight(dataLength - 1).top +
              rowHeight(dataLength - 1).height +
              headerRowHeight,
            width: contentWidth ? contentWidth : '100%',
          }}
        >
          <div
            className={cx({
              'dsg-scrollable-view': true,
              'dsg-scrollable-view-t': !edges.top,
              'dsg-scrollable-view-r': !edges.right,
              'dsg-scrollable-view-b': !edges.bottom,
              'dsg-scrollable-view-l': !edges.left,
            })}
            style={{
              top: headerRowHeight,
              left: stickyLeftWidth,
              height: viewHeight ? viewHeight - headerRowHeight : 0,
              width:
                contentWidth && viewWidth
                  ? Math.max(
                      0,
                      viewWidth -
                        stickyLeftWidth -
                        (hasStickyRightColumn
                          ? columnWidths[columnWidths.length - 1]
                          : 0)
                    )
                  : `max(0px, calc(100% - ${
                      stickyLeftWidth +
                      (hasStickyRightColumn
                        ? columnWidths[columnWidths.length - 1]
                        : 0)
                    }px))`,
            }}
          />
        </div>
        {markerRects.map(({ rect, sticky }) => (
          <div
            key={String(sticky)}
            className={cx(
              'dsg-selection-col-marker-container',
              overlayClass,
              sticky && 'dsg-sticky-left-overlay'
            )}
            style={{
              left: rect.left,
              width: rect.width,
              height:
                rowHeight(dataLength - 1).top +
                rowHeight(dataLength - 1).height +
                headerRowHeight,
            }}
          >
            <div
              className={cx(
                'dsg-selection-col-marker',
                selectionIsDisabled && 'dsg-selection-col-marker-disabled'
              )}
              style={{ top: headerRowHeight }}
            />
          </div>
        ))}
        {(selectionRect || activeCellRect) && (
          <div
            className="dsg-selection-row-marker-container"
            style={{
              top: selectionRect?.top ?? activeCellRect?.top,
              height: selectionRect?.height ?? activeCellRect?.height,
              width: contentWidth ? contentWidth : '100%',
            }}
          >
            <div
              className={cx(
                'dsg-selection-row-marker',
                selectionIsDisabled && 'dsg-selection-row-marker-disabled'
              )}
              style={{ left: stickyLeftWidth }}
            />
          </div>
        )}
        {activeRects.map(({ rect, sticky }) => (
          <div
            key={String(sticky)}
            className={cx('dsg-active-cell', overlayClass, {
              'dsg-active-cell-focus': editing,
              'dsg-active-cell-disabled': activeCellIsDisabled,
              'dsg-sticky-left-overlay': sticky,
            })}
            style={rect}
          />
        ))}
        {selectionRects.map(({ rect, sticky }) => {
          const active = activeRects.find(
            (part) => part.sticky === sticky
          )?.rect
          return (
            <div
              key={String(sticky)}
              className={cx(
                'dsg-selection-rect',
                overlayClass,
                sticky && 'dsg-sticky-left-overlay',
                selectionIsDisabled && 'dsg-selection-rect-disabled'
              )}
              style={{
                ...rect,
                clipPath: active
                  ? buildClipPath(
                      active.top - rect.top,
                      active.left - rect.left,
                      active.top + active.height - rect.top,
                      active.left + active.width - rect.left
                    )
                  : undefined,
              }}
            />
          )
        })}
        {expandRects.map(({ rect, sticky }) => (
          <div
            key={String(sticky)}
            className={cx(
              'dsg-expand-rows-rect',
              overlayClass,
              sticky && 'dsg-sticky-left-overlay'
            )}
            style={rect}
          />
        ))}
        {expandRowsIndicator && indicatorVisible && (
          <div
            className={cx(
              'dsg-expand-rows-indicator',
              overlayClass,
              indicatorSticky && 'dsg-sticky-left-overlay',
              selectionIsDisabled && 'dsg-expand-rows-indicator-disabled'
            )}
            style={{ ...expandRowsIndicator, left: indicatorLeft }}
          />
        )}
      </>
    )
  }
)

SelectionRect.displayName = 'SelectionRect'
