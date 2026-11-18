export type CollabValue = string | number | null
export type CollabRow = Record<string, unknown>

export interface CollabDatabase {
  exec(sql: string): void
  prepare(sql: string): {
    run(...values: CollabValue[]): unknown
    get(...values: CollabValue[]): CollabRow | undefined
    all(...values: CollabValue[]): CollabRow[]
  }
}

// Only a trusted authentication/run adapter may construct this context.
// IDs are identifiers, never bearer credentials or proof of authentication.
export interface CollabAccess {
  workspaceId: string
  principalId: string
  actorId: string
  mode: "act" | "observe"
}

export interface CollabActor {
  id: string
  workspaceId: string
  kind: "human" | "ai"
  name: string
  specialty: string
  status: "ready" | "paused" | "archived"
  profileVersion: number
  createdAt: string
}

export interface CollabConversation {
  id: string
  workspaceId: string
  kind: "dm" | "group"
  title: string
  createdBy: string
  createdAt: string
}

export interface CollabMessage {
  id: string
  conversationId: string
  authorId: string
  seq: number
  text: string
  createdAt: string
}

export type CollabErrorCode = "invalid_input" | "not_found" | "forbidden" | "read_only"
  | "idempotency_conflict" | "version_conflict" | "last_admin" | "schema_incompatible"

export class CollabError extends Error {
  constructor(public readonly code: CollabErrorCode) {
    super(code)
    this.name = "CollabError"
  }
}
