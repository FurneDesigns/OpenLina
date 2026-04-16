#!/usr/bin/env node
'use strict'

const http = require('http')
const { parse } = require('url')
const next = require('next')
const path = require('path')

const dev = process.env.NODE_ENV !== 'production'
const port = parseInt(process.env.OPENLINA_PORT || '3747', 10)

const app = next({ dev, dir: __dirname })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = http.createServer((req, res) => {
    const parsedUrl = parse(req.url || '/', true)
    handle(req, res, parsedUrl)
  })

  // Attach Socket.io — try tsx/ts-node for dev, fall back to a warning
  try {
    // In dev mode, use the TypeScript source directly via tsx register
    if (dev) {
      try {
        require('tsx/cjs/api').register()
      } catch {
        // tsx not available — try ts-node
        try { require('ts-node').register({ transpileOnly: true }) } catch { /* ignore */ }
      }
    }
    // Load the socket module (TS in dev, compiled JS in prod)
    const socketPath = dev
      ? path.join(__dirname, 'src/server/socket.ts')
      : path.join(__dirname, '.next/server/src/server/socket.js')
    const { initSocketServer } = require(socketPath)
    initSocketServer(httpServer)
    console.log('[openlina] Socket.io ready')
  } catch (err) {
    console.warn('[openlina] Socket.io not loaded:', err.message)
    console.warn('[openlina] Real-time features (terminal, agents) need "npm install tsx -D" or "npm run build"')
  }

  httpServer.listen(port, '127.0.0.1', () => {
    console.log(`\n  ┌──────────────────────────────────────────┐`)
    console.log(`  │  openlina running → http://localhost:${port}  │`)
    console.log(`  └──────────────────────────────────────────┘\n`)
  })

  process.on('SIGTERM', () => { httpServer.close(() => process.exit(0)) })
  process.on('SIGINT',  () => { httpServer.close(() => process.exit(0)) })
})
