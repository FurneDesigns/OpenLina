'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

const SEQUENCE_TIMEOUT = 800

export function useKeyboardShortcuts() {
  const router = useRouter()
  useEffect(() => {
    let buf: string[] = []
    let timer: NodeJS.Timeout | null = null
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() || ''
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) return
      buf.push(e.key.toLowerCase())
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { buf = [] }, SEQUENCE_TIMEOUT)
      const seq = buf.join('')
      if (seq === 'gp') router.push('/')
      else if (seq === 'gr') router.push('/runs')
      else if (seq === 'gs') router.push('/settings')
      else if (seq === 'gn') router.push('/projects/new')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [router])
}
