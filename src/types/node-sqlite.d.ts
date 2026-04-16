// Minimal type declarations for the built-in node:sqlite module (Node.js v22.5+)
declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    changes: number
    lastInsertRowid: number | bigint
  }

  export interface StatementSync {
    all(...params: unknown[]): unknown[]
    get(...params: unknown[]): unknown
    run(...params: unknown[]): StatementResultingChanges
    iterate(...params: unknown[]): IterableIterator<unknown>
  }

  export class DatabaseSync {
    constructor(location: string, options?: { open?: boolean })
    open(): void
    close(): void
    exec(sql: string): void
    prepare(sql: string): StatementSync
  }
}
