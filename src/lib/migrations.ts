type DatabaseSync = any

interface Migration {
  id: number
  name: string
  up: (db: DatabaseSync) => void
}

const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'settings',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );`)
    },
  },
  {
    id: 2,
    name: 'platforms',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS platforms (
        id           TEXT PRIMARY KEY,
        label        TEXT,
        api_key      TEXT,
        endpoint_url TEXT,
        enabled      INTEGER NOT NULL DEFAULT 1,
        created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
    },
  },
  {
    id: 3,
    name: 'llm_configs',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS llm_configs (
        id            TEXT PRIMARY KEY,
        platform_id   TEXT,
        label         TEXT,
        model_id      TEXT,
        provider_type TEXT NOT NULL,
        cli_command   TEXT,
        enabled       INTEGER NOT NULL DEFAULT 1,
        priority      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
    },
  },
  {
    id: 4,
    name: 'projects',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS projects (
        id                   TEXT PRIMARY KEY,
        name                 TEXT NOT NULL,
        slug                 TEXT UNIQUE,
        description          TEXT,
        project_type         TEXT,
        framework            TEXT,
        target_audience      TEXT,
        key_features         TEXT,
        tech_stack           TEXT,
        brand_colors         TEXT,
        deployment_target    TEXT,
        workspace_path       TEXT NOT NULL,
        target_llm_config_id TEXT,
        created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
    },
  },
  {
    id: 5,
    name: 'agents_table',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS agents (
        id                TEXT PRIMARY KEY,
        project_id        TEXT NOT NULL,
        name              TEXT NOT NULL,
        role              TEXT,
        responsibilities  TEXT,
        system_prompt     TEXT,
        execution_order   INTEGER NOT NULL DEFAULT 0,
        max_iterations    INTEGER NOT NULL DEFAULT 3,
        status            TEXT,
        created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
    },
  },
  {
    id: 6,
    name: 'agent_edges',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS agent_edges (
        from_id TEXT NOT NULL,
        to_id   TEXT NOT NULL,
        kind    TEXT NOT NULL DEFAULT 'flow'
      );`)
    },
  },
  {
    id: 7,
    name: 'agents_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_project ON agents(project_id);`)
    },
  },
  {
    id: 8,
    name: 'agent_edges_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_edges_from ON agent_edges(from_id);`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agent_edges_to ON agent_edges(to_id);`)
    },
  },
  {
    id: 9,
    name: 'projects_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);`)
    },
  },
  {
    id: 10,
    name: 'platforms_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_llm_configs_platform ON llm_configs(platform_id);`)
    },
  },
  {
    id: 11,
    name: 'project_runs',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS project_runs (
        id              TEXT PRIMARY KEY,
        project_id      TEXT NOT NULL,
        status          TEXT NOT NULL,
        iteration       INTEGER NOT NULL DEFAULT 0,
        max_iterations  INTEGER NOT NULL DEFAULT 1,
        started_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at    TEXT
      );`)
    },
  },
  {
    id: 12,
    name: 'run_steps',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS run_steps (
        id                   TEXT PRIMARY KEY,
        run_id               TEXT NOT NULL,
        agent_id             TEXT,
        agent_name           TEXT,
        role                 TEXT,
        iteration            INTEGER NOT NULL DEFAULT 1,
        status               TEXT NOT NULL,
        output               TEXT,
        tokens_used          INTEGER,
        reviewer_of_step_id  TEXT,
        verdict              TEXT,
        created_at           TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        completed_at         TEXT
      );`)
    },
  },
  {
    id: 13,
    name: 'run_steps_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_run_steps_run ON run_steps(run_id);`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_run_steps_iteration ON run_steps(run_id, iteration);`)
    },
  },
  {
    id: 14,
    name: 'project_runs_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_project ON project_runs(project_id);`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_runs_status ON project_runs(status);`)
    },
  },
  {
    id: 15,
    name: 'llm_failover_log',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS llm_failover_log (
        id             TEXT PRIMARY KEY,
        request_id     TEXT,
        llm_config_id  TEXT,
        error_type     TEXT,
        error_message  TEXT,
        ts             TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
    },
  },
  {
    id: 16,
    name: 'terminal_sessions',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS terminal_sessions (
        id          TEXT PRIMARY KEY,
        project_id  TEXT,
        label       TEXT,
        created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
    },
  },
  {
    id: 17,
    name: 'projects_target_llm',
    up: (db) => {
      // already in projects schema; make sure column exists in case of older DB
      try {
        db.exec(`ALTER TABLE projects ADD COLUMN target_llm_config_id TEXT;`)
      } catch {}
    },
  },
  {
    id: 18,
    name: 'agents_status_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_agents_order ON agents(project_id, execution_order);`)
    },
  },
  {
    id: 19,
    name: 'failover_log_idx',
    up: (db) => {
      db.exec(`CREATE INDEX IF NOT EXISTS idx_failover_request ON llm_failover_log(request_id);`)
    },
  },
  {
    id: 20,
    name: 'embeddings',
    up: (db) => {
      db.exec(`CREATE TABLE IF NOT EXISTS embeddings (
        id           TEXT PRIMARY KEY,
        source_type  TEXT NOT NULL,
        source_id    TEXT,
        project_id   TEXT,
        chunk_index  INTEGER NOT NULL DEFAULT 0,
        content      TEXT NOT NULL,
        vector       BLOB NOT NULL,
        model        TEXT NOT NULL,
        dims         INTEGER NOT NULL,
        created_at   TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_project ON embeddings(project_id);`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_type, source_id);`)
    },
  },
  {
    id: 21,
    name: 'agents_role_kind',
    up: (db) => {
      try { db.exec(`ALTER TABLE agents ADD COLUMN role_kind TEXT NOT NULL DEFAULT 'worker';`) } catch {}
      try { db.exec(`ALTER TABLE agents ADD COLUMN reviews_agent_id TEXT;`) } catch {}
    },
  },
]

export function runMigrations(db: DatabaseSync): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    id         INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );`)
  const appliedRows = db.prepare('SELECT id FROM schema_migrations').all() as { id: number }[]
  const applied = new Set(appliedRows.map((r) => r.id))
  for (const m of MIGRATIONS) {
    if (applied.has(m.id)) continue
    try {
      db.exec('BEGIN')
      m.up(db)
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(m.id)
      db.exec('COMMIT')
    } catch (err) {
      try { db.exec('ROLLBACK') } catch {}
      console.error(`[migrations] Failed migration ${m.id} (${m.name}):`, err)
      throw err
    }
  }
}
