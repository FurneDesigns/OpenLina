import type { DB } from './db'

interface Migration {
  id: number
  sql?: string
  run?: (db: DB) => void  // for multi-statement migrations (ALTER TABLE etc.)
}

const migrations: Migration[] = [
  {
    id: 1,
    sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
      id         INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    id: 2,
    sql: `CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  },
  {
    id: 3,
    sql: `CREATE TABLE IF NOT EXISTS platforms (
      id           TEXT PRIMARY KEY,
      label        TEXT NOT NULL,
      enabled      INTEGER NOT NULL DEFAULT 1,
      api_key_enc  TEXT,
      endpoint_url TEXT,
      org_id       TEXT,
      extra_config TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    id: 4,
    sql: `CREATE TABLE IF NOT EXISTS llm_configs (
      id              TEXT PRIMARY KEY,
      platform_id     TEXT NOT NULL REFERENCES platforms(id) ON DELETE CASCADE,
      model_id        TEXT NOT NULL,
      label           TEXT NOT NULL,
      priority        INTEGER NOT NULL,
      max_tokens      INTEGER,
      temperature     REAL NOT NULL DEFAULT 0.7,
      system_prompt   TEXT,
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_llm_configs_priority ON llm_configs(priority ASC)`,
  },
  {
    id: 5,
    sql: `CREATE TABLE IF NOT EXISTS projects (
      id               TEXT PRIMARY KEY,
      name             TEXT NOT NULL,
      project_type     TEXT NOT NULL,
      framework        TEXT NOT NULL,
      root_path        TEXT NOT NULL,
      i18n_strategy    TEXT NOT NULL DEFAULT 'none',
      i18n_locales     TEXT,
      default_locale   TEXT,
      extra_config     TEXT,
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    id: 6,
    sql: `CREATE TABLE IF NOT EXISTS agents (
      id            TEXT PRIMARY KEY,
      project_id    TEXT REFERENCES projects(id) ON DELETE SET NULL,
      name          TEXT NOT NULL,
      description   TEXT,
      llm_config_id TEXT REFERENCES llm_configs(id) ON DELETE SET NULL,
      system_prompt TEXT NOT NULL DEFAULT '',
      tools         TEXT NOT NULL DEFAULT '[]',
      canvas_x      REAL NOT NULL DEFAULT 100,
      canvas_y      REAL NOT NULL DEFAULT 100,
      status        TEXT NOT NULL DEFAULT 'idle',
      color         TEXT NOT NULL DEFAULT '#6366f1',
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    id: 7,
    sql: `CREATE TABLE IF NOT EXISTS agent_edges (
      id         TEXT PRIMARY KEY,
      source_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      target_id  TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      label      TEXT,
      edge_type  TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    id: 8,
    sql: `CREATE TABLE IF NOT EXISTS agent_messages (
      id          TEXT PRIMARY KEY,
      from_agent  TEXT,
      to_agent    TEXT,
      content     TEXT NOT NULL,
      role        TEXT NOT NULL DEFAULT 'assistant',
      metadata    TEXT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_agent_messages_to   ON agent_messages(to_agent,   created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_messages_from ON agent_messages(from_agent, created_at DESC)`,
  },
  {
    id: 9,
    sql: `CREATE TABLE IF NOT EXISTS llm_failover_log (
      id                 TEXT PRIMARY KEY,
      request_id         TEXT NOT NULL,
      llm_config_id      TEXT NOT NULL,
      error_type         TEXT NOT NULL,
      error_message      TEXT,
      context_tokens_in  INTEGER,
      context_tokens_out INTEGER,
      failed_at          TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
  },
  {
    id: 10,
    sql: `CREATE TABLE IF NOT EXISTS terminal_sessions (
      id         TEXT PRIMARY KEY,
      label      TEXT NOT NULL,
      command    TEXT NOT NULL DEFAULT '/bin/bash',
      cwd        TEXT NOT NULL DEFAULT '~',
      status     TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at  TEXT
    )`,
  },
  // ── Migration 11: extend projects ──────────────────────────────────────────
  {
    id: 11,
    run: (db) => {
      const cols = (db.prepare("PRAGMA table_info(projects)").all() as {name:string}[]).map(c=>c.name)
      if (!cols.includes('slug'))              db.exec("ALTER TABLE projects ADD COLUMN slug TEXT")
      if (!cols.includes('description'))       db.exec("ALTER TABLE projects ADD COLUMN description TEXT")
      if (!cols.includes('target_audience'))   db.exec("ALTER TABLE projects ADD COLUMN target_audience TEXT")
      if (!cols.includes('brand_colors'))      db.exec("ALTER TABLE projects ADD COLUMN brand_colors TEXT")
      if (!cols.includes('assets_dir'))        db.exec("ALTER TABLE projects ADD COLUMN assets_dir TEXT")
      if (!cols.includes('key_features'))      db.exec("ALTER TABLE projects ADD COLUMN key_features TEXT")
      if (!cols.includes('tech_stack'))        db.exec("ALTER TABLE projects ADD COLUMN tech_stack TEXT")
      if (!cols.includes('deployment_target')) db.exec("ALTER TABLE projects ADD COLUMN deployment_target TEXT")
      if (!cols.includes('workspace_path'))    db.exec("ALTER TABLE projects ADD COLUMN workspace_path TEXT")
      db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug)")
    },
  },
  // ── Migration 12: extend agents ────────────────────────────────────────────
  {
    id: 12,
    run: (db) => {
      const cols = (db.prepare("PRAGMA table_info(agents)").all() as {name:string}[]).map(c=>c.name)
      if (!cols.includes('role'))              db.exec("ALTER TABLE agents ADD COLUMN role TEXT NOT NULL DEFAULT 'dev'")
      if (!cols.includes('responsibilities'))  db.exec("ALTER TABLE agents ADD COLUMN responsibilities TEXT")
      if (!cols.includes('execution_order'))   db.exec("ALTER TABLE agents ADD COLUMN execution_order INTEGER NOT NULL DEFAULT 0")
      if (!cols.includes('max_iterations'))    db.exec("ALTER TABLE agents ADD COLUMN max_iterations INTEGER NOT NULL DEFAULT 3")
      db.exec("CREATE INDEX IF NOT EXISTS idx_agents_project_order ON agents(project_id, execution_order ASC)")
    },
  },
  // ── Migration 13: project_runs ─────────────────────────────────────────────
  {
    id: 13,
    sql: `CREATE TABLE IF NOT EXISTS project_runs (
      id             TEXT PRIMARY KEY,
      project_id     TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      status         TEXT NOT NULL DEFAULT 'running',
      iteration      INTEGER NOT NULL DEFAULT 0,
      max_iterations INTEGER NOT NULL DEFAULT 3,
      started_at     TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_project_runs_project ON project_runs(project_id, started_at DESC)`,
  },
  // ── Migration 14: run_steps ────────────────────────────────────────────────
  {
    id: 14,
    sql: `CREATE TABLE IF NOT EXISTS run_steps (
      id           TEXT PRIMARY KEY,
      run_id       TEXT NOT NULL REFERENCES project_runs(id) ON DELETE CASCADE,
      agent_id     TEXT REFERENCES agents(id) ON DELETE SET NULL,
      iteration    INTEGER NOT NULL DEFAULT 1,
      status       TEXT NOT NULL DEFAULT 'pending',
      output       TEXT,
      tokens_used  INTEGER,
      started_at   TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_run_steps_run ON run_steps(run_id, iteration ASC, started_at ASC)`,
  },
  // ── Migration 15: run tracking on messages ─────────────────────────────────
  {
    id: 15,
    run: (db) => {
      const cols = (db.prepare("PRAGMA table_info(agent_messages)").all() as {name:string}[]).map(c=>c.name)
      if (!cols.includes('run_id'))  db.exec("ALTER TABLE agent_messages ADD COLUMN run_id  TEXT")
      if (!cols.includes('step_id')) db.exec("ALTER TABLE agent_messages ADD COLUMN step_id TEXT")
    },
  },
  // ── Migration 16: agent_name + role snapshot in run_steps ─────────────────
  {
    id: 16,
    run: (db) => {
      const cols = (db.prepare("PRAGMA table_info(run_steps)").all() as {name:string}[]).map(c=>c.name)
      if (!cols.includes('agent_name')) db.exec("ALTER TABLE run_steps ADD COLUMN agent_name TEXT")
      if (!cols.includes('role'))       db.exec("ALTER TABLE run_steps ADD COLUMN role TEXT")
    },
  },
  // ── Migration 17: CLI provider support in llm_configs ──────────────────────
  {
    id: 17,
    run: (db) => {
      const cols = (db.prepare("PRAGMA table_info(llm_configs)").all() as {name:string}[]).map(c=>c.name)
      if (!cols.includes('provider_type')) db.exec("ALTER TABLE llm_configs ADD COLUMN provider_type TEXT NOT NULL DEFAULT 'api'")
      if (!cols.includes('cli_command'))   db.exec("ALTER TABLE llm_configs ADD COLUMN cli_command TEXT")
      if (!cols.includes('cli_env_vars'))  db.exec("ALTER TABLE llm_configs ADD COLUMN cli_env_vars TEXT")
      // Ensure the virtual _cli platform exists (parent for CLI-type configs)
      const exists = db.prepare("SELECT id FROM platforms WHERE id = '_cli'").get()
      if (!exists) {
        db.exec(`INSERT INTO platforms (id, label, enabled) VALUES ('_cli', 'CLI Tools', 1)`)
      }
    },
  },
  // ── Migration 18: Backfill provider_type='cli' for entries with cli_command ──
  {
    id: 18,
    run: (db) => {
      // When migration 17 added the column with DEFAULT 'api', existing CLI entries
      // got 'api' instead of 'cli'. Fix them by checking cli_command IS NOT NULL.
      db.exec(`UPDATE llm_configs SET provider_type = 'cli' WHERE cli_command IS NOT NULL AND cli_command != '' AND provider_type = 'api'`)
    },
  },
]

export function runMigrations(db: DB): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`)

  const applied = new Set<number>(
    (db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]).map((r) => r.id)
  )

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue
    if (migration.run) {
      migration.run(db)
    } else if (migration.sql) {
      db.exec(migration.sql)
    }
    db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(migration.id)
  }
}
