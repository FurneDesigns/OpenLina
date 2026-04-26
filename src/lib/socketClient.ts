'use client'
import { io, type Socket } from 'socket.io-client'

const cache = new Map<string, Socket>()

export function getSocket(namespace: '/pipeline' | '/terminal' | '/llm'): Socket {
  if (cache.has(namespace)) return cache.get(namespace)!
  const url = (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3747') + namespace
  const sock = io(url, { transports: ['websocket', 'polling'] })
  cache.set(namespace, sock)
  return sock
}
