import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createHarness } from './harness.mjs'
import { actors, createFixture } from './fixture.mjs'

async function until(check, label) {
  for (let i = 0; i < 150; i++) {
    if (await check()) return
    await delay(100)
  }
  throw new Error(`Timed out: ${label}`)
}

test('OpenCode IM integration with deterministic local model fixtures', { timeout: 180_000 }, async t => {
  const fixture = await createFixture()
  const harnesses = {}
  const sessions = {}
  const models = {}
  t.after(async () => {
    for (const harness of Object.values(harnesses)) await harness.close()
    await fixture.close()
  })

  for (const actor of actors) {
    const providerID = actor === 'editor' ? 'poc-b' : 'poc-a'
    models[actor] = { providerID, modelID: actor }
    const config = {
      autoupdate: false, snapshot: false, share: 'disabled', plugin: [],
      enabled_providers: [providerID], model: `${providerID}/${actor}`, small_model: `${providerID}/${actor}`,
      provider: { [providerID]: {
        npm: '@ai-sdk/openai-compatible',
        options: { baseURL: `${fixture.baseURL}/${providerID}/v1`, apiKey: 'local-fixture-not-a-secret' },
        models: { [actor]: { name: actor, tool_call: true, limit: { context: 32_000, output: 2_000 } } },
      } },
      permission: { '*': 'deny', capability_send_message: 'allow', ...(actor === 'writer' ? { capability_write_draft: 'allow' } : {}) },
      agent: { [actor]: { mode: 'primary', model: `${providerID}/${actor}`, steps: 3,
        prompt: `You are the independent ${actor}. Use only your own tools and explicitly delivered messages.` } },
      mcp: { capability: { type: 'local', enabled: true,
        command: [process.execPath, fileURLToPath(new URL('./mcp-fixture.mjs', import.meta.url)), fixture.baseURL, actor],
        environment: { POC_CAPABILITY_TOKEN: fixture.tokens[actor] },
      } },
    }
    const harness = await createHarness(config)
    harnesses[actor] = harness
    const health = await harness.start()
    assert.equal(health.version, '1.14.33', 'Revalidate contracts before changing the pinned harness version')
    const effective = await harness.api('/config')
    assert.deepEqual(effective.enabled_providers, [providerID])
    assert.deepEqual(effective.plugin, [])
    assert.deepEqual(Object.keys(effective.mcp), ['capability'])
    assert.deepEqual(Object.keys(effective.agent), [actor])
    sessions[actor] = (await harness.api('/session', { title: `${actor}:group` })).id
    assert.ok(sessions[actor])
  }

  function prompt(actor, action, session = sessions[actor], view = 'group') {
    return {
      agent: actor, model: models[actor],
      parts: [{ type: 'text', text: `Delivered context: ${JSON.stringify(fixture.observe(actor)[view])}\nPOC_ACTION:${JSON.stringify(action)}` }],
    }
  }

  async function run(actor, action, session = sessions[actor], view = 'group') {
    const response = await harnesses[actor].api(`/session/${session}/message`, prompt(actor, action, session, view))
    assert.equal(response.info?.error, undefined, JSON.stringify(response))
    // The synchronous endpoint returns only the last assistant message of a tool loop.
    const history = await harnesses[actor].api(`/session/${session}/message`)
    const tools = history.filter(message => message.info.parentID === response.info.parentID)
      .flatMap(message => message.parts).filter(part => part.type === 'tool')
    if (action.tool) {
      assert.equal(tools.length, 1, JSON.stringify(response))
      assert.equal(tools[0].state.status, 'completed', JSON.stringify(tools))
    }
    return response
  }

  await t.test('three independent actors publish to the group using native tool calls', async () => {
    for (const actor of actors) await run(actor, { tool: 'send_message', args: { conversation: 'group', text: `${actor}: my proposal` } })
    assert.deepEqual(fixture.observe('user').group.messages.map(message => message.author), actors)
    for (const actor of actors) {
      const list = await harnesses[actor].api('/session')
      assert.deepEqual(list.map(session => session.id), [sessions[actor]])
      assert.equal(list[0].parentID, undefined, 'Colleagues must not be temporary subagents')
    }
  })

  await t.test('different provider and model bindings with least-privilege tool exposure', () => {
    for (const actor of actors) {
      const request = fixture.requests.find(({ body }) => body.model === actor && body.tools?.length)
      assert.ok(request, `Missing model request for ${actor}`)
      assert.equal(request.path, `/${models[actor].providerID}/v1/chat/completions`)
      assert.deepEqual(request.body.tools.map(tool => tool.function.name).sort(),
        actor === 'writer' ? ['capability_send_message', 'capability_write_draft'] : ['capability_send_message'])
    }
  })

  await t.test('writer uses its separately attached writing capability', async () => {
    await run('writer', { tool: 'write_draft', args: { text: 'A deterministic draft fixture, not model-generated fiction.' } })
    assert.equal(fixture.drafts.length, 1)
    assert.equal(fixture.drafts[0].owner, 'writer')
  })

  await t.test('AI-to-AI private messages stay outside the editor context', async () => {
    sessions.writerPrivate = (await harnesses.writer.api('/session', { title: 'writer:private' })).id
    sessions.playwrightPrivate = (await harnesses.playwright.api('/session', { title: 'playwright:private' })).id
    await run('writer', { tool: 'send_message', args: { conversation: 'private', text: 'PRIVATE_CANARY_792: why does the protagonist leave?' } }, sessions.writerPrivate, 'private')
    await run('playwright', { tool: 'send_message', args: { conversation: 'private', text: 'The motive will be revised privately first.' } }, sessions.playwrightPrivate, 'private')
    await run('editor', { reply: 'I only received the group discussion.' })
    assert.equal(fixture.observe('writer').private.messages.length, 2)
    assert.equal(fixture.observe('editor').private, undefined)
    assert.equal(fixture.observe('user').private, undefined)
    assert.ok(fixture.requests.some(({ body }) => body.model === 'playwright' && JSON.stringify(body).includes('PRIVATE_CANARY_792')))
    assert.ok(fixture.requests.filter(({ body }) => body.model === 'editor').every(({ body }) => !JSON.stringify(body).includes('PRIVATE_CANARY_792')))
    const group = await harnesses.writer.api(`/session/${sessions.writer}/message`)
    assert.ok(!JSON.stringify(group).includes('PRIVATE_CANARY_792'))
  })

  await t.test('application gateway rejects unauthorized conversations, tools and sender spoofing', async () => {
    for (const params of [
      { name: 'send_message', arguments: { conversation: 'private', text: 'unauthorized' } },
      { name: 'write_draft', arguments: { text: 'unauthorized' } },
      { name: 'send_message', arguments: { conversation: 'group', text: 'spoof', author: 'writer' } },
    ]) {
      const response = await fetch(`${fixture.baseURL}/capability`, { method: 'POST',
        headers: { authorization: `Bearer ${fixture.tokens.editor}` }, body: JSON.stringify(params) })
      assert.equal(response.status, 403)
      await response.text()
    }
  })

  await t.test('observing a member reads state without invoking a model or changing messages', async () => {
    const before = fixture.requests.length
    const view = fixture.observe('writer')
    await harnesses.writer.api(`/session/${sessions.writerPrivate}/message`)
    assert.equal(fixture.requests.length, before)
    assert.deepEqual(fixture.observe('writer'), view)
  })

  await t.test('abort cancels one model stream while another member can still finish', async () => {
    await harnesses.writer.api(`/session/${sessions.writer}/prompt_async`, prompt('writer', { hold: true }))
    await until(() => fixture.held.size === 1, 'writer model stream started')
    await run('editor', { tool: 'send_message', args: { conversation: 'group', text: 'Editor can continue independently.' } })
    const before = fixture.disconnected()
    await harnesses.writer.api(`/session/${sessions.writer}/abort`, {})
    await until(() => fixture.disconnected() > before, 'provider connection closed after abort')
    await until(async () => !(await harnesses.writer.api('/session/status'))[sessions.writer] ||
      (await harnesses.writer.api('/session/status'))[sessions.writer]?.type === 'idle', 'writer idle')
  })

  await t.test('native sessions survive a harness restart and accept another turn', async () => {
    const before = await harnesses.writer.api(`/session/${sessions.writerPrivate}/message`)
    await harnesses.writer.stop()
    await harnesses.writer.start()
    const after = await harnesses.writer.api(`/session/${sessions.writerPrivate}/message`)
    assert.deepEqual(after, before)
    await run('writer', { reply: 'Resumed after restarting my harness.' }, sessions.writerPrivate, 'private')
  })

  t.diagnostic(`OpenCode 1.14.33; ${actors.length} isolated configs; 2 fixture provider IDs; ${fixture.requests.length} local model requests; no real-model quality claim`)
})
