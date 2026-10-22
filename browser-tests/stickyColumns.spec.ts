import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const cell = (page: Page, field: string, row = 0) =>
  page.locator(`input[value="${field}${row}"]`).locator('..')
const scroll = async (page: Page, left: number) => {
  await page.locator('.dsg-container').evaluate((element, value) => {
    element.scrollLeft = value
  }, left)
  await expect
    .poll(() =>
      page.locator('.dsg-container').evaluate((element) => element.scrollLeft)
    )
    .toBe(left)
}
const bounds = async (locator: Locator) => {
  const rect = await locator.boundingBox()
  if (!rect) throw new Error('Missing cell bounds')
  return rect
}
const data = async (page: Page): Promise<Record<string, string>[]> =>
  JSON.parse(await page.locator('#data').innerText())

test('leading data cells and header stay beside the gutter through horizontal and vertical scrolling', async ({
  page,
}) => {
  await page.goto('/')
  const a = await bounds(cell(page, 'a'))
  const b = await bounds(cell(page, 'b'))
  expect(Math.abs(a.y - b.y)).toBeLessThan(1)
  await scroll(page, 300)
  await expect.poll(async () => (await bounds(cell(page, 'a'))).x).toBe(a.x)
  expect((await bounds(cell(page, 'b'))).x).toBe(b.x)
  expect(
    (await bounds(page.locator('.dsg-row-header .dsg-cell-sticky-left').nth(1)))
      .x
  ).toBe(b.x)
  // Newly virtualized rows must retain the same frozen-column positions.
  await page.locator('.dsg-container').evaluate((element) => {
    element.scrollTop = 150
  })
  await expect(cell(page, 'a', 7)).toBeVisible()
  expect((await bounds(cell(page, 'a', 7))).x).toBe(a.x)
  expect((await bounds(cell(page, 'b', 7))).x).toBe(b.x)
})

test('gutter selects the row after scrolling; frozen cells can still be edited and cancelled', async ({
  page,
}) => {
  await page.goto('/')
  await scroll(page, 300)
  await page
    .locator('.dsg-row:not(.dsg-row-header) .dsg-cell-gutter')
    .first()
    .click()
  await expect
    .poll(async () => JSON.parse(await page.locator('#selection').innerText()))
    .toMatchObject({ min: { col: 0, row: 0 }, max: { col: 7, row: 0 } })
  await cell(page, 'b').click()
  await cell(page, 'b').dblclick()
  const input = cell(page, 'b').locator('input')
  await input.fill('changed')
  await input.press('Escape')
  expect((await data(page))[0].b).toBe('b0')
  await cell(page, 'b').dblclick()
  await input.fill('changed')
  await input.press('Tab')
  await expect.poll(async () => (await data(page))[0].b).toBe('changed')
  expect((await data(page))[0].a).toBe('a0')
})

test('cross-pane selection, clipboard and delete use logical columns and correctly clipped overlays', async ({
  page,
}) => {
  await page.goto('/')
  await scroll(page, 200)
  await cell(page, 'a').click()
  await cell(page, 'f', 1).click({ modifiers: ['Shift'] })
  await expect(page.locator('.dsg-selection-rect')).toHaveCount(2)
  const pinned = await bounds(
    page.locator('.dsg-selection-rect.dsg-sticky-left-overlay')
  )
  const moving = await bounds(
    page.locator('.dsg-selection-rect:not(.dsg-sticky-left-overlay)')
  )
  const b = await bounds(cell(page, 'b'))
  expect(Math.abs(pinned.x + pinned.width - b.x - b.width)).toBeLessThan(2)
  expect(Math.abs(moving.x - b.x - b.width)).toBeLessThan(2)
  const copied = await page.evaluate(() => {
    const clipboardData = new DataTransfer()
    document.dispatchEvent(
      new ClipboardEvent('copy', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      })
    )
    return clipboardData.getData('text/plain')
  })
  expect(copied).toBe('a0\tb0\tc0\td0\te0\tf0\na1\tb1\tc1\td1\te1\tf1')
  await page.keyboard.press('Delete')
  await expect.poll(async () => (await data(page))[1].f).toBe('')
  expect((await data(page))[0].a).toBe('')
  expect((await data(page))[0].g).toBe('g0')
})

test('fill handle follows the pinned cell and changes only its column', async ({
  page,
}) => {
  await page.goto('/')
  await scroll(page, 250)
  await cell(page, 'b').click()
  const original = await bounds(cell(page, 'b'))
  await expect
    .poll(async () => {
      const handle = await bounds(page.locator('.dsg-expand-rows-indicator'))
      return Math.abs(handle.x + handle.width / 2 - original.x - original.width)
    })
    .toBeLessThan(2)
  await scroll(page, 300)
  await expect
    .poll(async () => {
      const box = await bounds(page.locator('.dsg-expand-rows-indicator'))
      return Math.abs(box.x + box.width / 2 - original.x - original.width)
    })
    .toBeLessThan(2)
  const handle = await bounds(page.locator('.dsg-expand-rows-indicator'))
  expect(
    await page.evaluate(
      ({ x, y }) => document.elementFromPoint(x, y)?.className,
      { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }
    )
  ).toContain('dsg-expand-rows-indicator')
  const target = await bounds(cell(page, 'b', 2))
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    target.x + target.width - 2,
    target.y + target.height / 2,
    { steps: 8 }
  )
  await page.mouse.up()
  await expect.poll(async () => (await data(page))[2].b).toBe('b0')
  expect((await data(page))[1].b).toBe('b0')
  expect((await data(page))[2].c).toBe('c2')
})

test('keyboard navigation reveals unpinned cells and does not move pinned cells', async ({
  page,
}) => {
  await page.goto('/')
  await scroll(page, 200)
  await cell(page, 'f').click()
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await expect
    .poll(() =>
      page.locator('.dsg-container').evaluate((element) => element.scrollLeft)
    )
    .toBe(100)
  await expect
    .poll(async () => {
      const active = await bounds(page.locator('.dsg-active-cell'))
      const d = await bounds(cell(page, 'd'))
      return Math.abs(active.x - d.x)
    })
    .toBeLessThan(2)
  await page.getByRole('button', { name: 'Focus first' }).click()
  await expect
    .poll(() =>
      page.locator('.dsg-container').evaluate((element) => element.scrollLeft)
    )
    .toBe(100)
  await expect
    .poll(async () => {
      const frozen = await bounds(page.locator('.dsg-active-cell'))
      return Math.abs(frozen.x - (await bounds(cell(page, 'a'))).x)
    })
    .toBeLessThan(2)
})

for (const query of ['?right', '?right&noGutter', '?noGutter']) {
  test(`works with hidden gutter / sticky-right and can be disabled: ${query}`, async ({
    page,
  }) => {
    await page.goto('/' + query)
    const a = await bounds(cell(page, 'a'))
    const b = await bounds(cell(page, 'b'))
    expect(Math.abs(a.y - b.y)).toBeLessThan(1)
    const right = page.locator('.dsg-row-header .dsg-cell-sticky-right')
    const rightBounds = query.includes('right') ? await bounds(right) : null
    await scroll(page, 250)
    expect((await bounds(cell(page, 'a'))).x).toBe(a.x)
    expect((await bounds(cell(page, 'b'))).x).toBe(b.x)
    if (rightBounds) expect((await bounds(right)).x).toBe(rightBounds.x)
    await page.getByRole('button', { name: 'Toggle frozen' }).click()
    await expect(page.locator('.dsg-cell-sticky-left')).toHaveCount(0)
    await page.getByRole('button', { name: 'Toggle frozen' }).click()
    await expect.poll(async () => (await bounds(cell(page, 'a'))).x).toBe(a.x)
  })
}
