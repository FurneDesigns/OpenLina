'use client'
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : ''

const sockets: Record<string, Socket> = {}

export function useSocket(namespace: string): Socket {
  const url = `${BASE_URL}/${namespace.replace(/^\//, '')}`
  if (!sockets[namespace]) {
    sockets[namespace] = io(url, { transports: ['websocket', 'polling'] })
  }
  return sockets[namespace]
}
