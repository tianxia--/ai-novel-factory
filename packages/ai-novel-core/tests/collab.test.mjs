import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { FactoryDb } from "../dist/index.js"

async function setup(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "collab-store-test-"))
  let factory = await FactoryDb.open(root)
  let store = factory.getCollaborationStore()
  const owner = store.initializeWorkspace({ workspaceId: "w1", ownerPrincipalId: "owner:1", ownerName: "Owner" })
  const access = { workspaceId: "w1", principalId: "owner:1", actorId: owner.id, mode: "act" }
  const writer = store.createActor(access, { name: "Writer", specialty: "Fiction", instructions: "Write with restraint.", clientRequestId: "writer" })
  const editor = store.createActor(access, { name: "Editor", specialty: "Review", clientRequestId: "editor" })
  // Explicit fixtures stand in for principals resolved by a trusted worker/auth adapter.
  const memberAccess = member => ({ workspaceId: "w1", principalId: `agent:${member.id}`, actorId: member.id, mode: "act" })
  const observe = member => ({ ...access, actorId: member.id, mode: "observe" })
  const raw = new DatabaseSync(path.join(root, ".ai-novel-factory", "factory.sqlite"))
  t.after(async () => { raw.close(); factory.close(); await fs.rm(root, { recursive: true, force: true }) })
  return { root, raw, owner, access, writer, editor, memberAccess, observe,
    get store() { return store },
    async reopen() { factory.close(); factory = await FactoryDb.open(root); store = factory.getCollaborationStore(); return store },
  }
}

function fails(fn, code) { assert.throws(fn, error => error.code === code) }

test("collab storage is opt-in and uses the existing factory database", async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "collab-opt-in-"))
  const factory = await FactoryDb.open(root)
  const raw = new DatabaseSync(path.join(root, ".ai-novel-factory", "factory.sqlite"))
  t.after(async () => { raw.close(); factory.close(); await fs.rm(root, { recursive: true, force: true }) })
  assert.equal(raw.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE name = 'collab_actors'").get().count, 0)
  assert.equal(factory.getCollaborationStore(), factory.getCollaborationStore())
  assert.equal(raw.prepare("SELECT COUNT(*) AS count FROM collab_actors").get().count, 0)
  assert.equal(raw.prepare("SELECT COUNT(*) AS count FROM projects").get().count, 0)
})

test("workspace and actor creation are idempotent, paused and projectless", async t => {
  const s = await setup(t)
  assert.equal(s.store.initializeWorkspace({ workspaceId: "w1", ownerPrincipalId: "owner:1", ownerName: "Ignored" }).id, s.owner.id)
  fails(() => s.store.initializeWorkspace({ workspaceId: "w1", ownerPrincipalId: "intruder", ownerName: "No" }), "not_found")
  const retry = s.store.createActor(s.access, { name: "Writer", specialty: "Fiction", instructions: "Write with restraint.", clientRequestId: "writer" })
  assert.deepEqual(retry, s.writer)
  assert.equal(retry.status, "paused")
  fails(() => s.store.createActor(s.access, { name: "Another", specialty: "Fiction", clientRequestId: "writer" }), "idempotency_conflict")
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_actors").get().n, 3)
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM projects").get().n, 0)
})

test("profile edits preserve identity and reject stale versions", async t => {
  const s = await setup(t)
  const input = { name: "Renamed", specialty: "Stories", instructions: "New instructions", expectedVersion: 1, clientRequestId: "profile-1" }
  const updated = s.store.updateActor(s.access, s.writer.id, input)
  assert.equal(updated.id, s.writer.id)
  assert.equal(updated.profileVersion, 2)
  assert.deepEqual(s.store.updateActor(s.access, s.writer.id, input), updated)
  fails(() => s.store.updateActor(s.access, s.writer.id, { ...input, clientRequestId: "stale" }), "version_conflict")
  assert.equal(s.store.getProfile(s.observe(s.writer), s.writer.id).instructions, "New instructions")
  fails(() => s.store.getProfile(s.memberAccess(s.editor), s.writer.id), "not_found")
})

test("DM uniqueness is symmetric across distinct database connections", async t => {
  const s = await setup(t)
  const a = s.store.openDirectConversation(s.access, s.writer.id, "dm-a")
  const other = await FactoryDb.open(s.root)
  try {
    const b = other.getCollaborationStore().openDirectConversation(s.memberAccess(s.writer), s.owner.id, "dm-b")
    assert.equal(a.id, b.id)
  } finally { other.close() }
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_conversations").get().n, 1)
  fails(() => s.store.openDirectConversation(s.access, s.owner.id, "self"), "forbidden")
})

test("AI-to-AI DM has one timeline; owner normal view and unrelated members cannot read it", async t => {
  const s = await setup(t)
  const writerAccess = s.memberAccess(s.writer)
  const dm = s.store.openDirectConversation(writerAccess, s.editor.id, "private-dm")
  const sent = s.store.sendMessage(writerAccess, { conversationId: dm.id, text: "PRIVATE_CANARY", clientRequestId: "private-message" })
  assert.deepEqual(s.store.listMessages(s.memberAccess(s.editor), dm.id), [sent])
  assert.deepEqual(s.store.listMessages(s.observe(s.writer), dm.id), [sent])
  assert.equal(s.store.getPerspective(s.access).conversations.length, 0)
  fails(() => s.store.listMessages(s.access, dm.id), "not_found")
  const stranger = s.store.createActor(s.access, { name: "Stranger", specialty: "Research", clientRequestId: "stranger" })
  fails(() => s.store.listMessages(s.memberAccess(stranger), dm.id), "not_found")
})

test("observing never writes or processes pending inbox; owner cannot impersonate an AI", async t => {
  const s = await setup(t)
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  s.store.sendMessage(s.access, { conversationId: dm.id, text: "Hello", clientRequestId: "hello" })
  const before = s.raw.prepare("SELECT * FROM collab_deliveries").all()
  assert.equal(s.store.getPerspective(s.observe(s.writer)).conversations[0].pendingCount, 1)
  s.store.listMessages(s.observe(s.writer), dm.id)
  assert.deepEqual(s.raw.prepare("SELECT * FROM collab_deliveries").all(), before)
  fails(() => s.store.sendMessage(s.observe(s.writer), { conversationId: dm.id, text: "Spoof", clientRequestId: "spoof" }), "read_only")
  fails(() => s.store.sendMessage({ ...s.access, actorId: s.writer.id }, { conversationId: dm.id, text: "Spoof", clientRequestId: "spoof2" }), "not_found")
  fails(() => s.store.createGroup(s.observe(s.writer), { title: "Forbidden", inviteeIds: [], clientRequestId: "group" }), "read_only")
})

test("invitation grants no history; joining uses a new-message boundary", async t => {
  const s = await setup(t)
  const group = s.store.createGroup(s.access, { title: "Novel", inviteeIds: [s.writer.id], clientRequestId: "group" })
  const writerAccess = s.memberAccess(s.writer)
  s.store.sendMessage(s.access, { conversationId: group.id, text: "BEFORE_JOIN", clientRequestId: "before" })
  assert.equal(s.store.getPerspective(writerAccess).invitations.length, 1)
  assert.equal(s.store.getPerspective(writerAccess).conversations.length, 0)
  fails(() => s.store.listMessages(writerAccess, group.id), "not_found")
  s.store.respondToInvitation(writerAccess, group.id, 1, true, "accept")
  assert.equal(s.store.getPerspective(writerAccess).conversations[0].lastMessage, null)
  const after = s.store.sendMessage(s.access, { conversationId: group.id, text: "AFTER_JOIN", clientRequestId: "after" })
  assert.deepEqual(s.store.listMessages(writerAccess, group.id), [after])
  assert.equal(s.store.getPerspective(writerAccess).conversations[0].pendingCount, 1)
})

test("rejoin preserves epochs, rejects stale invitations and denied replay", async t => {
  const s = await setup(t)
  const writerAccess = s.memberAccess(s.writer)
  const group = s.store.createGroup(s.access, { title: "Group", inviteeIds: [s.writer.id], clientRequestId: "g" })
  s.store.respondToInvitation(writerAccess, group.id, 1, true, "accept-1")
  const input = { conversationId: group.id, text: "OLD_EPOCH", clientRequestId: "old-message" }
  s.store.sendMessage(writerAccess, input)
  s.store.leaveGroup(writerAccess, group.id, "leave")
  fails(() => s.store.sendMessage(writerAccess, input), "not_found")
  fails(() => s.store.listMessages(writerAccess, group.id), "not_found")
  assert.equal(s.store.invite(s.access, group.id, s.writer.id, "reinvite").epoch, 2)
  fails(() => s.store.respondToInvitation(writerAccess, group.id, 1, true, "stale-accept"), "version_conflict")
  s.store.respondToInvitation(writerAccess, group.id, 2, true, "accept-2")
  assert.deepEqual(s.store.listMessages(writerAccess, group.id), [])
  fails(() => s.store.sendMessage(writerAccess, input), "not_found")
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_memberships WHERE actor_id = ?").get(s.writer.id).n, 2)
})

test("only joined admins invite; the last admin cannot leave", async t => {
  const s = await setup(t)
  const group = s.store.createGroup(s.access, { title: "Group", inviteeIds: [s.writer.id], clientRequestId: "g" })
  const writerAccess = s.memberAccess(s.writer)
  s.store.respondToInvitation(writerAccess, group.id, 1, true, "accept")
  fails(() => s.store.invite(writerAccess, group.id, s.editor.id, "invite"), "forbidden")
  fails(() => s.store.leaveGroup(s.access, group.id, "leave-owner"), "last_admin")
  assert.equal(s.store.invite(s.access, group.id, s.editor.id, "invite-editor").status, "invited")
  s.store.respondToInvitation(s.memberAccess(s.editor), group.id, 1, false, "decline")
  assert.equal(s.store.getPerspective(s.memberAccess(s.editor)).invitations.length, 0)
})

test("messages, deliveries and retry receipts commit once with monotonic sequence", async t => {
  const s = await setup(t)
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  const input = { conversationId: dm.id, text: "Once", clientRequestId: "send" }
  const first = s.store.sendMessage(s.access, input)
  assert.deepEqual(s.store.sendMessage(s.access, input), first)
  fails(() => s.store.sendMessage(s.access, { ...input, text: "Changed" }), "idempotency_conflict")
  const second = s.store.sendMessage(s.access, { ...input, text: "Next", clientRequestId: "next" })
  assert.deepEqual([first.seq, second.seq], [1, 2])
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_deliveries").get().n, 2)
  assert.deepEqual(s.store.listMessages(s.access, dm.id, { beforeSeq: 2 }), [first])
  assert.deepEqual(s.store.listMessages(s.access, dm.id, { limit: 1 }), [second])
})

test("delivery failure rolls back message, sequence and command receipt", async t => {
  const s = await setup(t)
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  s.raw.exec("CREATE TRIGGER collab_test_failure BEFORE INSERT ON collab_deliveries BEGIN SELECT RAISE(ABORT, 'injected'); END")
  const input = { conversationId: dm.id, text: "Retry safely", clientRequestId: "retry" }
  assert.throws(() => s.store.sendMessage(s.access, input), /injected/)
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_messages").get().n, 0)
  assert.equal(s.raw.prepare("SELECT last_seq FROM collab_conversations WHERE id = ?").get(dm.id).last_seq, 0)
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_commands WHERE request_id = 'retry'").get().n, 0)
  s.raw.exec("DROP TRIGGER collab_test_failure")
  assert.equal(s.store.sendMessage(s.access, input).seq, 1)
})

test("cross-workspace actors, conversations, profiles and observers are denied", async t => {
  const s = await setup(t)
  const second = s.store.initializeWorkspace({ workspaceId: "w2", ownerPrincipalId: "owner:2", ownerName: "Other" })
  const secondAccess = { workspaceId: "w2", principalId: "owner:2", actorId: second.id, mode: "act" }
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  fails(() => s.store.listMessages(secondAccess, dm.id), "not_found")
  fails(() => s.store.openDirectConversation(secondAccess, s.writer.id, "cross-dm"), "not_found")
  fails(() => s.store.getProfile(secondAccess, s.writer.id), "not_found")
  fails(() => s.store.getPerspective({ ...s.observe(s.writer), principalId: "owner:2" }), "not_found")
  assert.equal(s.store.getPerspective(secondAccess).conversations.length, 0)
})

test("restart preserves actor identity, DM history, pending inbox and idempotency", async t => {
  const s = await setup(t)
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  const input = { conversationId: dm.id, text: "Persistent", clientRequestId: "persistent" }
  const sent = s.store.sendMessage(s.access, input)
  const before = s.store.getPerspective(s.observe(s.writer))
  await s.reopen()
  assert.deepEqual(s.store.getPerspective(s.observe(s.writer)), before)
  assert.deepEqual(s.store.sendMessage(s.access, input), sent)
  assert.equal(s.store.openDirectConversation(s.access, s.writer.id, "dm-again").id, dm.id)
})

test("invalid input and invalid invitees create no partial data", async t => {
  const s = await setup(t)
  fails(() => s.store.createActor(s.access, { name: " ", specialty: "No", clientRequestId: "empty" }), "invalid_input")
  fails(() => s.store.createGroup(s.access, { title: "No", inviteeIds: [s.writer.id, "missing"], clientRequestId: "bad-group" }), "not_found")
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_conversations").get().n, 0)
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  fails(() => s.store.sendMessage(s.access, { conversationId: dm.id, text: " ", clientRequestId: "empty-message" }), "invalid_input")
  fails(() => s.store.listMessages(s.access, dm.id, { limit: 201 }), "invalid_input")
  fails(() => s.store.listMessages(s.access, dm.id, { beforeSeq: -1 }), "invalid_input")
  assert.equal(s.raw.prepare("SELECT COUNT(*) AS n FROM collab_messages").get().n, 0)
})

test("every actor-scoped command rejects observation without changing stored state", async t => {
  const s = await setup(t)
  const group = s.store.createGroup(s.access, { title: "Group", inviteeIds: [s.writer.id], clientRequestId: "g" })
  const ownerView = s.observe(s.owner)
  const writerView = s.observe(s.writer)
  const commands = [
    () => s.store.createActor(ownerView, { name: "Blocked", specialty: "Review", clientRequestId: "c1" }),
    () => s.store.updateActor(ownerView, s.writer.id, { name: "Blocked", specialty: "Review", instructions: "", expectedVersion: 1, clientRequestId: "c2" }),
    () => s.store.openDirectConversation(writerView, s.editor.id, "c3"),
    () => s.store.createGroup(writerView, { title: "Blocked", inviteeIds: [], clientRequestId: "c4" }),
    () => s.store.invite(ownerView, group.id, s.editor.id, "c5"),
    () => s.store.respondToInvitation(writerView, group.id, 1, true, "c6"),
    () => s.store.leaveGroup(ownerView, group.id, "c7"),
    () => s.store.sendMessage(ownerView, { conversationId: group.id, text: "Blocked", clientRequestId: "c8" }),
  ]
  const tables = ["collab_actors", "collab_conversations", "collab_memberships", "collab_messages", "collab_deliveries", "collab_commands"]
  const snapshot = () => tables.map(table => s.raw.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all())
  const before = snapshot()
  for (const command of commands) fails(command, "read_only")
  assert.deepEqual(snapshot(), before)
})

test("a newer collab schema is rejected without overwriting versions or messages", async t => {
  const s = await setup(t)
  const dm = s.store.openDirectConversation(s.access, s.writer.id, "dm")
  const sent = s.store.sendMessage(s.access, { conversationId: dm.id, text: "Preserved", clientRequestId: "send" })
  s.raw.prepare("INSERT INTO collab_schema_versions VALUES (2, ?)").run(new Date().toISOString())
  const versions = s.raw.prepare("SELECT * FROM collab_schema_versions ORDER BY version").all()
  const messages = s.raw.prepare("SELECT * FROM collab_messages ORDER BY seq").all()
  await assert.rejects(() => s.reopen(), error => error.code === "schema_incompatible")
  assert.deepEqual(s.raw.prepare("SELECT * FROM collab_schema_versions ORDER BY version").all(), versions)
  assert.deepEqual(s.raw.prepare("SELECT * FROM collab_messages ORDER BY seq").all(), messages)
  assert.equal(messages[0].id, sent.id)
})
