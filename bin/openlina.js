#!/usr/bin/env node
'use strict'

const { spawn } = require('child_process')
const path = require('path')
const http = require('http')

const PORT = parseInt(process.env.OPENLINA_PORT || '3747', 10)
const SERVER_PATH = path.join(__dirname, '..', 'server.js')
const HEALTH_URL = `http://localhost:${PORT}/api/health`
const MAX_WAIT_MS = 30_000
const POLL_INTERVAL_MS = 500

async function poll(url, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        http.get(url, (res) => {
          if (res.statusCode === 200) resolve()
          else reject(new Error(`Status ${res.statusCode}`))
          res.resume()
        }).on('error', reject)
      })
      return true
    } catch {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    }
  }
  return false
}

async function openBrowser(url) {
  try {
    const open = require('open')
    await open(url)
  } catch {
    console.log(`\n  Open your browser and navigate to: ${url}\n`)
  }
}

async function main() {
  console.log('\n  Starting openlina...\n')

  const child = spawn(process.execPath, [SERVER_PATH], {
    stdio: 'inherit',
    env: { ...process.env, OPENLINA_PORT: String(PORT) },
  })

  child.on('error', (err) => {
    console.error('Failed to start server:', err.message)
    process.exit(1)
  })

  child.on('exit', (code) => {
    if (code !== 0) process.exit(code ?? 1)
  })

  process.on('SIGINT', () => {
    child.kill('SIGTERM')
    process.exit(0)
  })
  process.on('SIGTERM', () => {
    child.kill('SIGTERM')
    process.exit(0)
  })

  const ready = await poll(HEALTH_URL, MAX_WAIT_MS)
  if (!ready) {
    console.error('\n  Server did not start within 30 seconds. Check the output above.\n')
    child.kill()
    process.exit(1)
  }

  await openBrowser(`http://localhost:${PORT}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
