import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

test.use({ hasTouch: true })

type Point = { x: number; y: number }

// A real touch sequence (not mouse emulation): the browser decides between panning
// and pointer events from `touch-action`, as it does on a phone.
async function touchDrag(page: Page, from: Point, to: Point): Promise<void> {
  const session = await page.context().newCDPSession(page)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [from],
  })
  for (let step = 1; step <= 8; step++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        {
          x: from.x + ((to.x - from.x) * step) / 8,
          y: from.y + ((to.y - from.y) * step) / 8,
        },
      ],
    })
  }
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
}

async function center(page: Page, selector: string): Promise<Point> {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`Missing ${selector}`)
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

const column = async (page: Page, field: string): Promise<string[]> =>
  (
    JSON.parse(await page.locator('#data').innerText()) as Record<
      string,
      string
    >[]
  ).map((row) => row[field])

test('a finger drag on the fill handle fills the rows below', async ({
  page,
}) => {
  await page.goto('/?sticky=0')
  await page.locator('input[value="a0"]').locator('..').tap()
  await touchDrag(
    page,
    await center(page, '.dsg-expand-rows-indicator'),
    await center(page, 'input[value="a2"]')
  )

  await expect
    .poll(async () => (await column(page, 'a')).slice(0, 4))
    .toEqual(['a0', 'a0', 'a0', 'a3'])
  expect((await column(page, 'b')).slice(0, 3)).toEqual(['b0', 'b1', 'b2'])
})

test('a finger drag elsewhere still scrolls the grid and fills nothing', async ({
  page,
}) => {
  await page.goto('/?sticky=0')
  await page.locator('input[value="a0"]').locator('..').tap()
  const before = await column(page, 'a')
  const from = await center(page, 'input[value="b3"]')
  await touchDrag(page, from, { x: from.x, y: from.y - 90 })

  await expect
    .poll(() =>
      page.locator('.dsg-container').evaluate((element) => element.scrollTop)
    )
    .toBeGreaterThan(0)
  expect(await column(page, 'a')).toEqual(before)
})
