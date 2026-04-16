import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { DATA_DIR } from './db'

const KEY_FILE = path.join(DATA_DIR, 'machine.key')
const ALGORITHM = 'aes-256-gcm'

function getMachineKey(): Buffer {
  if (!fs.existsSync(KEY_FILE)) {
    const key = crypto.randomBytes(32)
    fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true })
    fs.writeFileSync(KEY_FILE, key.toString('hex'), { mode: 0o600 })
    return key
  }
  return Buffer.from(fs.readFileSync(KEY_FILE, 'utf-8').trim(), 'hex')
}

export function encrypt(plaintext: string): string {
  const key = getMachineKey()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  // Format: iv(24 hex) + authTag(32 hex) + ciphertext(hex)
  return iv.toString('hex') + authTag.toString('hex') + encrypted.toString('hex')
}

export function decrypt(ciphertext: string): string {
  const key = getMachineKey()
  const iv = Buffer.from(ciphertext.slice(0, 24), 'hex')
  const authTag = Buffer.from(ciphertext.slice(24, 56), 'hex')
  const encrypted = Buffer.from(ciphertext.slice(56), 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return decipher.update(encrypted).toString('utf-8') + decipher.final('utf-8')
}
