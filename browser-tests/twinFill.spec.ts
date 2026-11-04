import { expect, test } from '@playwright/test'

// Every grid listens to document mouse events, so a fill drag that starts on one
// grid's handle must not put the other grids into fill mode: they would follow the
// pointer and scroll themselves towards the column under it.
test('a fill drag in another grid does not scroll this one', async ({
  page,
}) => {
  await page.goto('/?sticky=0&twin')
  const main = page.locator('#main .dsg-container')
  // The first grid does overflow sideways, so it could scroll.
  expect(
    await main.evaluate((element) => element.scrollWidth - element.clientWidth)
  ).toBeGreaterThan(0)

  await page.locator('#twin input[value="ta0"]').locator('..').click()
  const handle = await page
    .locator('#twin .dsg-expand-rows-indicator')
    .boundingBox()
  const target = await page.locator('#twin input[value="ta2"]').boundingBox()
  if (!handle || !target) throw new Error('Missing fill handle or target')
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2
  )
  await page.mouse.down()
  // Right of both grids: the first one would scroll to its last column.
  await page.mouse.move(900, target.y + target.height / 2, { steps: 8 })
  await page.mouse.up()

  // The drag was a real fill in the twin...
  const twin = JSON.parse(
    await page.locator('#twin-data').innerText()
  ) as Record<string, string>[]
  expect(twin.slice(0, 4).map((row) => row.a)).toEqual([
    'ta0',
    'ta0',
    'ta0',
    'ta3',
  ])
  // ...and the first grid did not move.
  expect(
    await main.evaluate((element) => ({
      left: element.scrollLeft,
      top: element.scrollTop,
    }))
  ).toEqual({ left: 0, top: 0 })
})
