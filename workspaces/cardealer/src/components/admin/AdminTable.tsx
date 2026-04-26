import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react'

export function AdminTable({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`w-full overflow-x-auto rounded-2xl border border-border bg-white ${className}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <table className="w-full text-sm">
        {children}
      </table>
    </div>
  )
}

export function AdminTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-border bg-surface-muted/60">
      {children}
    </thead>
  )
}

export function AdminTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function AdminTr({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr className={`transition-colors hover:bg-table-hover ${className}`}>
      {children}
    </tr>
  )
}

export function AdminTh({
  children,
  className = '',
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider whitespace-nowrap ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

export function AdminTd({
  children,
  className = '',
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { className?: string }) {
  return (
    <td className={`px-4 py-3 text-slate-700 ${className}`} {...props}>
      {children}
    </td>
  )
}
