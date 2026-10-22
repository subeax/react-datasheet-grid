import { expect, test } from '@playwright/test'

// A width edit must not discard the lazy text editor or corrupt subsequent fill geometry.
test('resize commits pending text and the shifted fill handle still fills its own column', async ({
  page,
}) => {
  await page.goto('/resize')
  const root = page.getByRole('region', { name: 'main', exact: true })
  const input = root.locator('input[value="b0"]')
  await input.locator('..').dblclick()
  await input.fill('pending')
  const resize = root.getByRole('separator', {
    name: 'Resize column a',
    exact: true,
  })
  await resize.hover()
  const box = await resize.boundingBox()
  if (!box) throw new Error('Missing resize handle')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2, {
    steps: 5,
  })
  await page.mouse.up()
  await expect(root.getByTestId('commits')).toHaveText('1')
  await expect
    .poll(
      async () => JSON.parse(await root.getByTestId('data').innerText())[0].b
    )
    .toBe('pending')

  // Resizing preserves the selected cell; clicking it again would reopen editing.
  const fill = root.locator('.dsg-expand-rows-indicator')
  await fill.hover()
  const handle = await fill.boundingBox()
  const target = await root.locator('input[value="b2"]').boundingBox()
  if (!handle || !target) throw new Error('Missing fill handle or target')
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(
    target.x + target.width - 2,
    target.y + target.height / 2,
    { steps: 5 }
  )
  await page.mouse.up()
  await expect
    .poll(
      async () => JSON.parse(await root.getByTestId('data').innerText())[2].b
    )
    .toBe('pending')
  expect(JSON.parse(await root.getByTestId('data').innerText())[2].c).toBe('c2')
})
