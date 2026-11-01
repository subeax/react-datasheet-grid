import { expect, test } from '@playwright/test'

// The grid learns its width from a ResizeObserver, which reports only after a later
// layout. A click before that (a quick user, or a busy main thread) must still select
// the cell under the pointer instead of being dropped.
test('a click right after the grid mounts selects the cell under it', async ({
  page,
}) => {
  await page.goto('/?lazy&sticky=0')
  const result = await page.evaluate(async () => {
    const show = document.querySelector<HTMLButtonElement>('#show')
    show?.click()
    // React commits the discrete update in a microtask. No rendering step, and so no
    // ResizeObserver report, can run before this task ends.
    await Promise.resolve()
    await Promise.resolve()
    const cell = document
      .querySelector('input[value="a1"]')
      ?.closest('.dsg-cell')
    if (!cell) return 'no cell'
    const box = cell.getBoundingClientRect()
    const init = {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: box.left + box.width / 2,
      clientY: box.top + box.height / 2,
    }
    cell.dispatchEvent(new MouseEvent('mousedown', init))
    cell.dispatchEvent(new MouseEvent('mouseup', init))
    return 'clicked'
  })
  expect(result).toBe('clicked')
  await expect(page.locator('#selection')).toHaveText(
    JSON.stringify({
      min: { col: 0, row: 1, colId: 'a' },
      max: { col: 0, row: 1, colId: 'a' },
    })
  )
})
