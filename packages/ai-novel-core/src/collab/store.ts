import { createHash, randomUUID } from "node:crypto"
import { CollabError, type CollabAccess, type CollabActor, type CollabConversation,
  type CollabDatabase, type CollabMessage, type CollabRow } from "./contracts"
import { COLLAB_SCHEMA } from "./schema"

function text(value: unknown, max = 200, allowEmpty = false): string {
  if (typeof value !== "string" || value.length > max || (!allowEmpty && !value.trim())) {
    throw new CollabError("invalid_input")
  }
  return value.trim()
}

function positiveInteger(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1) throw new CollabError("invalid_input")
  return value
}

function actor(row: CollabRow): CollabActor {
  return { id: String(row.id), workspaceId: String(row.workspace_id), kind: row.kind as CollabActor["kind"],
    name: String(row.name), specialty: String(row.specialty), status: row.status as CollabActor["status"],
    profileVersion: Number(row.profile_version), createdAt: String(row.created_at) }
}

function conversation(row: CollabRow): CollabConversation {
  return { id: String(row.id), workspaceId: String(row.workspace_id), kind: row.kind as CollabConversation["kind"],
    title: String(row.title), createdBy: String(row.created_by), createdAt: String(row.created_at) }
}

function message(row: CollabRow): CollabMessage {
  return { id: String(row.id), conversationId: String(row.conversation_id), authorId: String(row.author_id),
    seq: Number(row.seq), text: String(row.text), createdAt: String(row.created_at) }
}

export class CollaborationStore {
  constructor(private readonly db: CollabDatabase) {
    this.transaction(() => {
      db.exec("CREATE TABLE IF NOT EXISTS collab_schema_versions (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)")
      const version = db.prepare("SELECT MAX(version) AS version FROM collab_schema_versions").get()?.version
      if (version && Number(version) !== 1) throw new CollabError("schema_incompatible")
      db.exec(COLLAB_SCHEMA)
      db.prepare("INSERT OR IGNORE INTO collab_schema_versions(version, applied_at) VALUES (1, ?)").run(new Date().toISOString())
    })
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE")
    try {
      const result = fn()
      this.db.exec("COMMIT")
      return result
    } catch (error) {
      this.db.exec("ROLLBACK")
      throw error
    }
  }

  private actorRow(workspaceId: string, actorId: string) {
    const row = this.db.prepare("SELECT * FROM collab_actors WHERE workspace_id = ? AND id = ?").get(workspaceId, actorId)
    if (!row) throw new CollabError("not_found")
    return row
  }

  private access(context: CollabAccess, write = false) {
    if (!context || !["act", "observe"].includes(context.mode)) throw new CollabError("forbidden")
    const workspace = this.db.prepare("SELECT * FROM collab_workspaces WHERE id = ?").get(context.workspaceId)
    const subject = this.actorRow(context.workspaceId, context.actorId)
    if (!workspace || (context.mode === "observe"
      ? workspace.owner_principal_id !== context.principalId
      : subject.principal_id !== context.principalId)) throw new CollabError("not_found")
    if (write && context.mode === "observe") throw new CollabError("read_only")
    if (write && subject.status === "archived") throw new CollabError("forbidden")
    return { workspace, subject }
  }

  private owner(context: CollabAccess) {
    const { workspace } = this.access(context, true)
    if (workspace.owner_principal_id !== context.principalId) throw new CollabError("forbidden")
  }

  private conversationRow(context: CollabAccess, id: string) {
    const row = this.db.prepare("SELECT * FROM collab_conversations WHERE workspace_id = ? AND id = ?").get(context.workspaceId, id)
    if (!row) throw new CollabError("not_found")
    return row
  }

  private membership(context: CollabAccess, id: string) {
    this.access(context)
    const row = this.db.prepare(`SELECT * FROM collab_memberships
      WHERE workspace_id = ? AND conversation_id = ? AND actor_id = ? AND status = 'joined'`)
      .get(context.workspaceId, id, context.actorId)
    if (!row) throw new CollabError("not_found")
    return row
  }

  private command<T>(context: CollabAccess, requestId: string, operation: string, input: unknown,
    authorize: () => void, execute: () => T, validateReplay?: (result: T) => void): T {
    text(requestId, 128)
    const fingerprint = createHash("sha256").update(JSON.stringify([operation, context.actorId, input])).digest("hex")
    return this.transaction(() => {
      this.access(context, true)
      // Recheck current access before returning even a previously committed result.
      authorize()
      const prior = this.db.prepare(`SELECT * FROM collab_commands WHERE workspace_id = ? AND principal_id = ? AND request_id = ?`)
        .get(context.workspaceId, context.principalId, requestId)
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new CollabError("idempotency_conflict")
        const result = JSON.parse(String(prior.result_json)) as T
        validateReplay?.(result)
        return result
      }
      const result = execute()
      this.db.prepare("INSERT INTO collab_commands VALUES (?, ?, ?, ?, ?)")
        .run(context.workspaceId, context.principalId, requestId, fingerprint, JSON.stringify(result))
      return result
    })
  }

  // Trusted provisioning only; this is not an unauthenticated HTTP endpoint.
  initializeWorkspace(input: { workspaceId: string; ownerPrincipalId: string; ownerName: string }): CollabActor {
    const workspaceId = text(input.workspaceId)
    const principalId = text(input.ownerPrincipalId)
    const name = text(input.ownerName, 80)
    return this.transaction(() => {
      const existing = this.db.prepare("SELECT * FROM collab_workspaces WHERE id = ?").get(workspaceId)
      if (existing) {
        if (existing.owner_principal_id !== principalId) throw new CollabError("not_found")
        return actor(this.db.prepare("SELECT * FROM collab_actors WHERE workspace_id = ? AND principal_id = ?").get(workspaceId, principalId)!)
      }
      const now = new Date().toISOString()
      const id = randomUUID()
      this.db.prepare("INSERT INTO collab_workspaces VALUES (?, ?, ?)").run(workspaceId, principalId, now)
      this.db.prepare(`INSERT INTO collab_actors VALUES (?, ?, ?, 'human', ?, '', '', 'ready', 1, ?)`)
        .run(id, workspaceId, principalId, name, now)
      return actor(this.actorRow(workspaceId, id))
    })
  }

  createActor(context: CollabAccess, input: { name: string; specialty: string; instructions?: string; clientRequestId: string }) {
    const profile = { name: text(input.name, 80), specialty: text(input.specialty, 240), instructions: text(input.instructions ?? "", 16_000, true) }
    return this.command(context, input.clientRequestId, "createActor", profile, () => this.owner(context), () => {
      const id = randomUUID()
      this.db.prepare(`INSERT INTO collab_actors VALUES (?, ?, ?, 'ai', ?, ?, ?, 'paused', 1, ?)`)
        .run(id, context.workspaceId, `agent:${id}`, profile.name, profile.specialty, profile.instructions, new Date().toISOString())
      return actor(this.actorRow(context.workspaceId, id))
    })
  }

  updateActor(context: CollabAccess, id: string, input: { name: string; specialty: string; instructions: string; expectedVersion: number; clientRequestId: string }) {
    const profile = { id, name: text(input.name, 80), specialty: text(input.specialty, 240), instructions: text(input.instructions, 16_000, true), expectedVersion: positiveInteger(input.expectedVersion) }
    return this.command(context, input.clientRequestId, "updateActor", profile, () => {
      this.owner(context)
      this.actorRow(context.workspaceId, id)
    }, () => {
      if (this.actorRow(context.workspaceId, id).profile_version !== profile.expectedVersion) throw new CollabError("version_conflict")
      this.db.prepare(`UPDATE collab_actors SET name = ?, specialty = ?, instructions = ?, profile_version = profile_version + 1
        WHERE workspace_id = ? AND id = ?`).run(profile.name, profile.specialty, profile.instructions, context.workspaceId, id)
      return actor(this.actorRow(context.workspaceId, id))
    })
  }

  getProfile(context: CollabAccess, id: string) {
    const { workspace } = this.access(context)
    if (context.actorId !== id && workspace.owner_principal_id !== context.principalId) throw new CollabError("not_found")
    const row = this.actorRow(context.workspaceId, id)
    return { ...actor(row), instructions: String(row.instructions) }
  }

  openDirectConversation(context: CollabAccess, peerId: string, clientRequestId: string) {
    const pair = [context.actorId, text(peerId)].sort()
    return this.command(context, clientRequestId, "openDM", pair, () => {
      const peer = this.actorRow(context.workspaceId, peerId)
      if (peerId === context.actorId || peer.status === "archived") throw new CollabError("forbidden")
    }, () => {
      const key = JSON.stringify(pair)
      const existing = this.db.prepare("SELECT * FROM collab_conversations WHERE workspace_id = ? AND dm_key = ?").get(context.workspaceId, key)
      if (existing) return conversation(existing)
      const id = randomUUID()
      this.db.prepare(`INSERT INTO collab_conversations VALUES (?, ?, 'dm', '', ?, ?, 0, ?)`)
        .run(id, context.workspaceId, key, context.actorId, new Date().toISOString())
      for (const memberId of pair) this.db.prepare(`INSERT INTO collab_memberships VALUES (?, ?, ?, 1, 'joined', 'member', 1, NULL)`)
        .run(context.workspaceId, id, memberId)
      return conversation(this.conversationRow(context, id))
    })
  }

  createGroup(context: CollabAccess, input: { title: string; inviteeIds: string[]; clientRequestId: string }) {
    if (!Array.isArray(input.inviteeIds) || input.inviteeIds.length > 100) throw new CollabError("invalid_input")
    const data = { title: text(input.title, 120), inviteeIds: [...new Set(input.inviteeIds.map(id => text(id)))].filter(id => id !== context.actorId).sort() }
    return this.command(context, input.clientRequestId, "createGroup", data, () => {
      for (const id of data.inviteeIds) if (this.actorRow(context.workspaceId, id).status === "archived") throw new CollabError("forbidden")
    }, () => {
      const id = randomUUID()
      this.db.prepare(`INSERT INTO collab_conversations VALUES (?, ?, 'group', ?, NULL, ?, 0, ?)`)
        .run(id, context.workspaceId, data.title, context.actorId, new Date().toISOString())
      this.db.prepare(`INSERT INTO collab_memberships VALUES (?, ?, ?, 1, 'joined', 'admin', 1, NULL)`)
        .run(context.workspaceId, id, context.actorId)
      for (const memberId of data.inviteeIds) this.db.prepare(`INSERT INTO collab_memberships VALUES (?, ?, ?, 1, 'invited', 'member', NULL, NULL)`)
        .run(context.workspaceId, id, memberId)
      return conversation(this.conversationRow(context, id))
    })
  }

  invite(context: CollabAccess, conversationId: string, actorId: string, clientRequestId: string) {
    return this.command(context, clientRequestId, "invite", [conversationId, actorId], () => {
      if (this.membership(context, conversationId).role !== "admin" || this.conversationRow(context, conversationId).kind !== "group") throw new CollabError("forbidden")
      if (this.actorRow(context.workspaceId, actorId).status === "archived") throw new CollabError("forbidden")
    }, () => {
      const existing = this.db.prepare(`SELECT * FROM collab_memberships WHERE conversation_id = ? AND actor_id = ? AND status != 'left'`).get(conversationId, actorId)
      if (existing) return { epoch: Number(existing.epoch), status: String(existing.status) }
      const epoch = Number(this.db.prepare("SELECT COALESCE(MAX(epoch), 0) AS epoch FROM collab_memberships WHERE conversation_id = ? AND actor_id = ?").get(conversationId, actorId)!.epoch) + 1
      this.db.prepare(`INSERT INTO collab_memberships VALUES (?, ?, ?, ?, 'invited', 'member', NULL, NULL)`).run(context.workspaceId, conversationId, actorId, epoch)
      return { epoch, status: "invited" }
    })
  }

  respondToInvitation(context: CollabAccess, conversationId: string, epoch: number, accept: boolean, clientRequestId: string) {
    if (typeof accept !== "boolean") throw new CollabError("invalid_input")
    positiveInteger(epoch)
    return this.command(context, clientRequestId, "respondInvitation", [conversationId, epoch, accept], () => {
      const membership = this.db.prepare("SELECT 1 FROM collab_memberships WHERE workspace_id = ? AND conversation_id = ? AND actor_id = ? AND epoch = ?")
        .get(context.workspaceId, conversationId, context.actorId, epoch)
      if (!membership) throw new CollabError("not_found")
    }, () => {
      const membership = this.db.prepare(`SELECT * FROM collab_memberships WHERE conversation_id = ? AND actor_id = ? AND epoch = ? AND status = 'invited'`).get(conversationId, context.actorId, epoch)
      if (!membership) throw new CollabError("version_conflict")
      const boundary = Number(this.conversationRow(context, conversationId).last_seq) + 1
      this.db.prepare("UPDATE collab_memberships SET status = ?, joined_seq = ? WHERE conversation_id = ? AND actor_id = ? AND epoch = ?")
        .run(accept ? "joined" : "left", accept ? boundary : null, conversationId, context.actorId, Number(membership.epoch))
      return { conversationId, epoch: Number(membership.epoch), status: accept ? "joined" : "left" }
    })
  }

  leaveGroup(context: CollabAccess, conversationId: string, clientRequestId: string) {
    return this.command(context, clientRequestId, "leaveGroup", [conversationId], () => {
      this.conversationRow(context, conversationId)
    }, () => {
      const member = this.membership(context, conversationId)
      const group = this.conversationRow(context, conversationId)
      if (group.kind !== "group") throw new CollabError("forbidden")
      if (member.role === "admin") throw new CollabError("last_admin")
      this.db.prepare("UPDATE collab_memberships SET status = 'left', left_seq = ? WHERE conversation_id = ? AND actor_id = ? AND epoch = ?")
        .run(Number(group.last_seq), conversationId, context.actorId, Number(member.epoch))
      return { conversationId, epoch: Number(member.epoch), status: "left" }
    })
  }

  sendMessage(context: CollabAccess, input: { conversationId: string; text: string; clientRequestId: string }) {
    const data = { conversationId: text(input.conversationId), text: text(input.text, 32_000) }
    return this.command(context, input.clientRequestId, "sendMessage", data, () => {
      this.membership(context, data.conversationId)
    }, () => {
      const seq = Number(this.conversationRow(context, data.conversationId).last_seq) + 1
      const id = randomUUID()
      const now = new Date().toISOString()
      this.db.prepare("UPDATE collab_conversations SET last_seq = ? WHERE id = ?").run(seq, data.conversationId)
      this.db.prepare("INSERT INTO collab_messages VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(id, context.workspaceId, data.conversationId, context.actorId, seq, data.text, now)
      this.db.prepare(`INSERT INTO collab_deliveries(workspace_id, message_id, actor_id, membership_epoch)
        SELECT workspace_id, ?, actor_id, epoch FROM collab_memberships
        WHERE conversation_id = ? AND status = 'joined' AND actor_id != ?`).run(id, data.conversationId, context.actorId)
      return { id, conversationId: data.conversationId, authorId: context.actorId, seq, text: data.text, createdAt: now }
    }, result => {
      if (result.seq < Number(this.membership(context, data.conversationId).joined_seq)) throw new CollabError("not_found")
    })
  }

  listMessages(context: CollabAccess, conversationId: string, options: { beforeSeq?: number; limit?: number } = {}): CollabMessage[] {
    const member = this.membership(context, conversationId)
    const limit = positiveInteger(options.limit ?? 50)
    if (limit > 200) throw new CollabError("invalid_input")
    const before = positiveInteger(options.beforeSeq ?? Number.MAX_SAFE_INTEGER)
    return this.db.prepare(`SELECT * FROM collab_messages WHERE workspace_id = ? AND conversation_id = ? AND seq >= ? AND seq < ?
      ORDER BY seq DESC LIMIT ?`).all(context.workspaceId, conversationId, Number(member.joined_seq), before, limit).reverse().map(message)
  }

  getPerspective(context: CollabAccess) {
    const { subject } = this.access(context)
    const conversations = this.db.prepare(`SELECT c.*, m.joined_seq, m.epoch FROM collab_conversations c
      JOIN collab_memberships m ON m.conversation_id = c.id
      WHERE c.workspace_id = ? AND m.actor_id = ? AND m.status = 'joined' ORDER BY c.created_at, c.id`)
      .all(context.workspaceId, context.actorId).map(row => {
        const last = this.db.prepare("SELECT * FROM collab_messages WHERE conversation_id = ? AND seq >= ? ORDER BY seq DESC LIMIT 1").get(String(row.id), Number(row.joined_seq))
        const pending = this.db.prepare(`SELECT COUNT(*) AS count FROM collab_deliveries d JOIN collab_messages msg ON msg.id = d.message_id
          WHERE msg.conversation_id = ? AND d.actor_id = ? AND d.membership_epoch = ? AND d.state = 'pending'`)
          .get(String(row.id), context.actorId, Number(row.epoch))
        const members = this.db.prepare(`SELECT a.id, a.name FROM collab_memberships m JOIN collab_actors a ON a.id = m.actor_id
          WHERE m.conversation_id = ? AND m.status = 'joined' ORDER BY a.id`).all(String(row.id))
        return { ...conversation(row), members: members.map(item => ({ id: String(item.id), name: String(item.name) })),
          lastMessage: last ? message(last) : null, pendingCount: Number(pending!.count) }
      })
    const invitations = this.db.prepare(`SELECT c.id, c.title, m.epoch FROM collab_memberships m
      JOIN collab_conversations c ON c.id = m.conversation_id
      WHERE m.workspace_id = ? AND m.actor_id = ? AND m.status = 'invited' ORDER BY c.id`)
      .all(context.workspaceId, context.actorId).map(row => ({ conversationId: String(row.id), title: String(row.title), epoch: Number(row.epoch) }))
    return { actor: actor(subject), mode: context.mode, conversations, invitations }
  }
}
