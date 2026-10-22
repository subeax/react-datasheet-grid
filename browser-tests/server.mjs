import { build } from 'esbuild'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
// Optionally exercise an already installed React version without modifying the lockfile.
const alternateReact = process.env.REACT_TEST_ROOT
const alternateRequire =
  alternateReact && createRequire(resolve(alternateReact, 'package.json'))
const { outputFiles } = await build({
  entryPoints: [resolve(root, 'browser-tests/fixture.tsx')],
  bundle: true,
  write: false,
  outfile: 'bundle.js',
  define: {
    'process.env.NODE_ENV': JSON.stringify(
      process.env.BROWSER_TEST_MODE ?? 'development'
    ),
  },
  plugins: alternateRequire
    ? [
        {
          name: 'alternate-react',
          setup(builder) {
            builder.onResolve(
              { filter: /^react(?:-dom)?(?:\/|$)/ },
              ({ path }) => ({ path: alternateRequire.resolve(path) })
            )
          },
        },
      ]
    : [],
})
const assets = new Map(
  outputFiles.map((file) => ['/' + basename(file.path), file.contents])
)
const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  const asset = assets.get(path)
  if (asset) {
    response.setHeader(
      'Content-Type',
      path.endsWith('.css') ? 'text/css' : 'text/javascript'
    )
    response.end(asset)
  } else {
    response.setHeader('Content-Type', 'text/html')
    response.end(
      '<!doctype html><html><head><link rel="stylesheet" href="/bundle.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>'
    )
  }
})
server.listen(3197, '127.0.0.1')
process.on('SIGTERM', () => server.close())
