// Custom Next + Socket.io server (Node >= 22.5, --experimental-sqlite required)
const http = require('node:http')
const path = require('node:path')
const { parse } = require('node:url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.PORT || process.env.OPENLINA_PORT || '3747', 10)
const hostname = process.env.HOST || '0.0.0.0'

let lastEbadfLog = 0
process.on('uncaughtException', (err) => {
  if (err && err.code === 'EBADF') {
    const now = Date.now()
    if (now - lastEbadfLog > 60_000) {
      lastEbadfLog = now
      console.warn('[server] Swallowed EBADF (rate-limited)')
    }
    return
  }
  console.error('[server] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandledRejection:', reason)
})

// Register tsx so we can require .ts files (server/socket.ts) at runtime in dev/prod.
try {
  require('tsx/cjs/api').register()
} catch (err) {
  console.error('[server] Failed to register tsx loader:', err)
  process.exit(1)
}

const app = next({ dev, hostname, port, dir: path.resolve(__dirname) })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const server = http.createServer(async (req, res) => {
    try {
      await handle(req, res, parse(req.url, true))
    } catch (err) {
      console.error('[server] request error:', err)
      res.statusCode = 500
      res.end('internal error')
    }
  })

  try {
    const { initSocketServer } = require('./src/server/socket.ts')
    initSocketServer(server)
  } catch (err) {
    console.error('[server] Failed to init socket server:', err)
  }

  server.listen(port, hostname, () => {
    console.log(`> OpenLina ready on http://${hostname}:${port}`)
  })
})
