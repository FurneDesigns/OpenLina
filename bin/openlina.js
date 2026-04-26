#!/usr/bin/env node
const path = require('node:path')
const { spawn } = require('node:child_process')

const root = path.resolve(__dirname, '..')
const serverPath = path.join(root, 'server.js')

const args = ['--experimental-sqlite', serverPath, ...process.argv.slice(2)]

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  cwd: process.cwd(),
  env: {
    ...process.env,
    OPENLINA_DATA_DIR: process.env.OPENLINA_DATA_DIR || path.join(process.cwd(), '.openlina-data'),
  },
})

child.on('exit', (code) => process.exit(code ?? 0))
