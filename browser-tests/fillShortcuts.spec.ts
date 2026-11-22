import { expect, Page, test } from '@playwright/test'

// With locked rows, Ctrl+D fills down and Ctrl+R fills right, as in spreadsheets.
async function data(page: Page) {
  return JSON.parse(await page.locator('#data').innerText()) as Record<
    string,
    string
  >[]
}

async function selectCell(page: Page, value: string) {
  await page.locator(`#main input[value="${value}"]`).locator('..').click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?sticky=0')
})

test('Ctrl+D copies the first selected row down', async ({ page }) => {
  await selectCell(page, 'a1')
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Control+d')

  await expect
    .poll(async () => (await data(page)).slice(0, 5).map((row) => row.a))
    .toEqual(['a0', 'a1', 'a1', 'a1', 'a4'])
  expect((await data(page)).slice(1, 4).map((row) => row.b)).toEqual([
    'b1',
    'b1',
    'b1',
  ])
  expect((await data(page))[1].c).toBe('c1')
})

test('Ctrl+D on one row copies the row above', async ({ page }) => {
  await selectCell(page, 'b2')
  await page.keyboard.press('Control+d')

  await expect
    .poll(async () => (await data(page)).slice(1, 4).map((row) => row.b))
    .toEqual(['b1', 'b1', 'b3'])
  expect((await data(page))[2].a).toBe('a2')
})

test('Ctrl+R copies the first selected column right', async ({ page }) => {
  await selectCell(page, 'a1')
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowRight')
  await page.keyboard.press('Shift+ArrowDown')
  await page.keyboard.press('Control+r')

  await expect
    .poll(async () => {
      const rows = await data(page)
      return [rows[1], rows[2]].map(({ a, b, c, d }) => [a, b, c, d])
    })
    .toEqual([
      ['a1', 'a1', 'a1', 'd1'],
      ['a2', 'a2', 'a2', 'd2'],
    ])
  expect((await data(page))[0].b).toBe('b0')
})

test('Ctrl+R on one column copies the column to the left', async ({ page }) => {
  await selectCell(page, 'b2')
  await page.keyboard.press('Control+r')

  await expect
    .poll(async () => (await data(page))[2])
    .toMatchObject({ a: 'a2', b: 'a2', c: 'c2' })
  expect((await data(page))[1].b).toBe('b1')
})

test('the first row and column have nothing to copy', async ({ page }) => {
  await selectCell(page, 'a0')
  await page.keyboard.press('Control+d')
  await page.keyboard.press('Control+r')
  await page.keyboard.press('ArrowDown')

  // The grid kept its active cell and no cell changed.
  await expect(page.locator('#selection')).not.toHaveText('null')
  expect((await data(page))[0]).toMatchObject({ a: 'a0', b: 'b0' })
})
