import { expect, test } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

const sheet = (page: Page, name = 'main') =>
  page.getByRole('region', { name, exact: true })
const handle = (root: Locator, id: string) =>
  root.getByRole('separator', { name: `Resize column ${id}`, exact: true })
const cell = (root: Locator, id: string) =>
  root.locator(`input[value="${id}0"]`).locator('..')
const rect = async (locator: Locator) => {
  const result = await locator.boundingBox()
  if (!result) throw new Error('Missing element bounds')
  return result
}
async function beginDrag(page: Page, locator: Locator) {
  // Wait for the virtualizer's initial measurement before taking coordinates.
  await locator.hover()
  const box = await rect(locator)
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  return { x, y }
}
async function resize(page: Page, root: Locator, id: string, delta: number) {
  const start = await beginDrag(page, handle(root, id))
  await page.mouse.move(start.x + delta, start.y, { steps: 5 })
  await page.mouse.up()
}
const widths = async (
  root: Locator,
  id = 'committed'
): Promise<Record<string, number>> =>
  JSON.parse(await root.getByTestId(id).innerText())
const expectWidth = async (root: Locator, id: string, width: number) => {
  await expect.poll(async () => (await rect(cell(root, id))).width).toBe(width)
  await expect(handle(root, id)).toHaveAttribute('aria-valuenow', String(width))
}

test('resize is opt-in and never includes gutter or sticky-right action cells', async ({
  page,
}) => {
  await page.goto('/resize?disabled&right')
  const root = sheet(page)
  await expect(root.getByRole('separator')).toHaveCount(0)
  await root.getByRole('button', { name: 'Toggle resizing main' }).click()
  await expect(handle(root, 'a')).toBeVisible()
  await expect(handle(root, 'b')).toBeVisible()
  await root.locator('.dsg-container').evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expect(handle(root, 'h')).toBeVisible()
  await expect(root.locator('.dsg-cell-gutter .dsg-resize-handle')).toHaveCount(
    0
  )
  await expect(
    root.locator('.dsg-cell-sticky-right .dsg-resize-handle')
  ).toHaveCount(0)
  await expect(root.getByTestId('commits')).toHaveText('0')
})

test('drag updates header, body and sticky offsets live, but commits only once and leaves row data unchanged', async ({
  page,
}) => {
  await page.goto('/resize')
  const root = sheet(page)
  await cell(root, 'b').click()
  await expect(root.getByTestId('selection')).toContainText('"col":1')
  const originalData = await root.getByTestId('data').innerText()
  const originalSelection = await root.getByTestId('selection').innerText()
  const start = await beginDrag(page, handle(root, 'a'))
  await page.mouse.move(start.x + 50, start.y, { steps: 5 })
  await expectWidth(root, 'a', 150)
  expect(await widths(root, 'preview')).toEqual({ a: 150 })
  await expect(root.getByTestId('commits')).toHaveText('0')
  const a = await rect(cell(root, 'a'))
  const b = await rect(cell(root, 'b'))
  expect(Math.abs(a.x + a.width - b.x)).toBeLessThan(1)
  await expect
    .poll(async () =>
      Math.abs(
        (await rect(root.locator('.dsg-active-cell'))).x -
          (
            await rect(cell(root, 'b'))
          ).x
      )
    )
    .toBeLessThan(2)
  await page.mouse.up()
  await expect(root.getByTestId('commits')).toHaveText('1')
  expect(await widths(root)).toEqual({ a: 150 })
  expect(await root.getByTestId('data').innerText()).toBe(originalData)
  expect(await root.getByTestId('selection').innerText()).toBe(
    originalSelection
  )
})

test('limits, persisted widths and stable IDs survive reload and column reorder', async ({
  page,
}) => {
  await page.goto('/resize')
  const root = sheet(page)
  await resize(page, root, 'a', 350)
  await expectWidth(root, 'a', 220)
  await resize(page, root, 'a', -200)
  await expectWidth(root, 'a', 60)
  await resize(page, root, 'b', 40)
  await expect(root.getByTestId('commits')).toHaveText('3')
  expect(await widths(root)).toEqual({ a: 60, b: 140 })
  await page.reload()
  await expectWidth(root, 'a', 60)
  await expectWidth(root, 'b', 140)
  await expect(root.getByTestId('commits')).toHaveText('0')
  await root.getByRole('button', { name: 'Reverse columns main' }).click()
  await root.locator('.dsg-container').evaluate((element) => {
    element.scrollLeft = element.scrollWidth
  })
  await expectWidth(root, 'a', 60)
  await expectWidth(root, 'b', 140)
})

test('Escape cancels a drag, restores flexible sizing, and does not leave listeners behind', async ({
  page,
}) => {
  await page.goto('/resize?flexible&sticky=0')
  const root = sheet(page)
  const original = await rect(cell(root, 'a'))
  const start = await beginDrag(page, handle(root, 'a'))
  await page.mouse.move(start.x + 50, start.y, { steps: 5 })
  await expect
    .poll(async () => (await rect(cell(root, 'a'))).width)
    .toBeGreaterThan(original.width + 40)
  await page.keyboard.press('Escape')
  await page.mouse.up()
  await expect
    .poll(async () => (await rect(cell(root, 'a'))).width)
    .toBe(original.width)
  await expect(root.getByTestId('commits')).toHaveText('0')
  expect(await widths(root, 'preview')).toEqual({})
  await page.mouse.move(start.x + 100, start.y)
  await resize(page, root, 'a', 20)
  await expect(root.getByTestId('commits')).toHaveText('1')
  const total = await root
    .locator('.dsg-row-header .dsg-cell')
    .evaluateAll((cells) =>
      cells.reduce(
        (sum, element) => sum + element.getBoundingClientRect().width,
        0
      )
    )
  const viewport = await root
    .locator('.dsg-container')
    .evaluate((element) => element.clientWidth)
  expect(Math.abs(total - viewport)).toBeLessThan(2)
})

test('two grids with the same column IDs resize independently and preserve existing document handlers', async ({
  page,
}) => {
  await page.goto('/resize')
  await page.evaluate(() => {
    document.onpointerup = () => {
      document.body.dataset.externalUp = 'called'
    }
  })
  const main = sheet(page)
  const second = sheet(page, 'second')
  await cell(second, 'b').click()
  await resize(page, main, 'a', 40)
  // Resizing another grid is an outside interaction for the previous keyboard owner.
  await expect(second.getByTestId('selection')).toHaveText('null')
  await expectWidth(main, 'a', 140)
  await expectWidth(second, 'a', 100)
  await resize(page, second, 'a', 60)
  await expectWidth(second, 'a', 160)
  await expectWidth(main, 'a', 140)
  await expect(main.getByTestId('commits')).toHaveText('1')
  await expect(second.getByTestId('commits')).toHaveText('1')
  expect(await page.evaluate(() => document.body.dataset.externalUp)).toBe(
    'called'
  )
})

for (const action of ['Toggle resizing main', 'Toggle grid main']) {
  test(`${action} during drag cleans up and cancels instead of committing`, async ({
    page,
  }) => {
    await page.goto('/resize')
    const root = sheet(page)
    const start = await beginDrag(page, handle(root, 'a'))
    await page.mouse.move(start.x + 30, start.y, { steps: 3 })
    await expectWidth(root, 'a', 130)
    // A parent can remove the handle while a pointer is captured (e.g. route/column change).
    await root
      .getByRole('button', { name: action, exact: true })
      .evaluate((button: HTMLButtonElement) => button.click())
    await page.mouse.move(start.x + 100, start.y)
    await page.mouse.up()
    await expect(root.getByTestId('commits')).toHaveText('0')
    await root.getByRole('button', { name: action, exact: true }).click()
    await expectWidth(root, 'a', 100)
    await resize(page, root, 'a', 20)
    await expect(root.getByTestId('commits')).toHaveText('1')
  })
}

test('resizes scrolled columns with frozen neighbours, then keeps clipboard and keyboard navigation correct', async ({
  page,
}) => {
  await page.goto('/resize?right')
  const root = sheet(page)
  await root.locator('.dsg-container').evaluate((element) => {
    element.scrollLeft = 240
  })
  await resize(page, root, 'f', 20)
  await expectWidth(root, 'f', 120)
  await cell(root, 'f').click()
  await page.evaluate(() => {
    const clipboardData = new DataTransfer()
    clipboardData.setData('text/plain', 'value')
    document.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData,
        bubbles: true,
        cancelable: true,
      })
    )
  })
  await expect
    .poll(
      async () => JSON.parse(await root.getByTestId('data').innerText())[0].f
    )
    .toBe('value')
  await page.keyboard.press('ArrowLeft')
  await expect
    .poll(
      async () =>
        JSON.parse(await root.getByTestId('selection').innerText()).min.col
    )
    .toBe(4)
  await expect
    .poll(async () =>
      Math.abs(
        (await rect(root.locator('.dsg-active-cell'))).x -
          (
            await rect(cell(root, 'e'))
          ).x
      )
    )
    .toBeLessThan(2)
})

test('keyboard resizing changes widths, not selected cell contents', async ({
  page,
}) => {
  await page.goto('/resize?noGutter')
  const root = sheet(page)
  await cell(root, 'a').click()
  const before = await root.getByTestId('data').innerText()
  await handle(root, 'a').focus()
  await page.keyboard.press('ArrowRight')
  await expectWidth(root, 'a', 110)
  await page.keyboard.press('End')
  await expectWidth(root, 'a', 220)
  await page.keyboard.press('Home')
  await expectWidth(root, 'a', 60)
  expect(await root.getByTestId('data').innerText()).toBe(before)
  await expect(root.getByTestId('commits')).toHaveText('3')
})
