export const COLLAB_SCHEMA = `
  CREATE TABLE IF NOT EXISTS collab_schema_versions (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collab_workspaces (
    id TEXT PRIMARY KEY,
    owner_principal_id TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS collab_actors (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES collab_workspaces(id),
    principal_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('human','ai')),
    name TEXT NOT NULL,
    specialty TEXT NOT NULL,
    instructions TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('ready','paused','archived')),
    profile_version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE(workspace_id, id),
    UNIQUE(workspace_id, principal_id)
  );
  CREATE TABLE IF NOT EXISTS collab_conversations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES collab_workspaces(id),
    kind TEXT NOT NULL CHECK(kind IN ('dm','group')),
    title TEXT NOT NULL,
    dm_key TEXT,
    created_by TEXT NOT NULL,
    last_seq INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    UNIQUE(workspace_id, id),
    UNIQUE(workspace_id, dm_key),
    FOREIGN KEY(workspace_id, created_by) REFERENCES collab_actors(workspace_id, id)
  );
  CREATE TABLE IF NOT EXISTS collab_memberships (
    workspace_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    epoch INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('invited','joined','left')),
    role TEXT NOT NULL CHECK(role IN ('admin','member')),
    joined_seq INTEGER,
    left_seq INTEGER,
    PRIMARY KEY(conversation_id, actor_id, epoch),
    FOREIGN KEY(workspace_id, conversation_id) REFERENCES collab_conversations(workspace_id, id),
    FOREIGN KEY(workspace_id, actor_id) REFERENCES collab_actors(workspace_id, id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS collab_active_membership
    ON collab_memberships(conversation_id, actor_id) WHERE status != 'left';
  CREATE TABLE IF NOT EXISTS collab_messages (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    author_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(conversation_id, seq),
    UNIQUE(workspace_id, id),
    FOREIGN KEY(workspace_id, conversation_id) REFERENCES collab_conversations(workspace_id, id),
    FOREIGN KEY(workspace_id, author_id) REFERENCES collab_actors(workspace_id, id)
  );
  CREATE TABLE IF NOT EXISTS collab_deliveries (
    workspace_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    membership_epoch INTEGER NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','processed')),
    PRIMARY KEY(message_id, actor_id),
    FOREIGN KEY(workspace_id, message_id) REFERENCES collab_messages(workspace_id, id),
    FOREIGN KEY(workspace_id, actor_id) REFERENCES collab_actors(workspace_id, id)
  );
  CREATE INDEX IF NOT EXISTS collab_inbox ON collab_deliveries(workspace_id, actor_id, state);
  CREATE TABLE IF NOT EXISTS collab_commands (
    workspace_id TEXT NOT NULL REFERENCES collab_workspaces(id),
    principal_id TEXT NOT NULL,
    request_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    result_json TEXT NOT NULL,
    PRIMARY KEY(workspace_id, principal_id, request_id)
  );
`
