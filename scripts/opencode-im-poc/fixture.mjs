import { createServer } from 'node:http'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'

export const actors = ['playwright', 'writer', 'editor']

export async function createFixture() {
  const tokens = Object.fromEntries(actors.map(actor => [actor, randomUUID()]))
  const conversations = {
    group: { members: ['user', ...actors], messages: [] },
    private: { members: ['playwright', 'writer'], messages: [] },
  }
  const drafts = []
  const requests = []
  const held = new Set()
  let disconnected = 0

  function dispatch(actor, name, args) {
    if (!actors.includes(actor)) throw new Error('Unknown actor')
    if (name === 'send_message') {
      if (!conversations[args.conversation]?.members.includes(actor)) throw new Error('Conversation access denied')
      if (Object.keys(args).sort().join(',') !== 'conversation,text' || typeof args.text !== 'string') throw new Error('Invalid message')
      const message = { id: randomUUID(), author: actor, text: args.text }
      conversations[args.conversation].messages.push(message)
      return message
    }
    if (name === 'write_draft' && actor === 'writer') {
      if (Object.keys(args).join(',') !== 'text' || typeof args.text !== 'string') throw new Error('Invalid draft')
      const draft = { id: randomUUID(), owner: actor, text: args.text }
      drafts.push(draft)
      return draft
    }
    throw new Error('Capability access denied')
  }

  function observe(actor) {
    if (!['user', ...actors].includes(actor)) throw new Error('Unknown actor')
    return structuredClone(Object.fromEntries(Object.entries(conversations).filter(([, value]) => value.members.includes(actor))))
  }

  const server = createServer(async (req, res) => {
    try {
      let raw = ''
      for await (const chunk of req) {
        raw += chunk
        if (raw.length > 1_000_000) throw new Error('Request too large')
      }
      const body = JSON.parse(raw || '{}')
      if (req.url === '/capability') {
        const actor = actors.find(id => `Bearer ${tokens[id]}` === req.headers.authorization)
        if (!actor) { res.writeHead(401).end(); return }
        try {
          const result = dispatch(actor, body.name, body.arguments)
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result))
        } catch (error) { res.writeHead(403).end(JSON.stringify({ error: error.message })) }
        return
      }
      if (!/^\/poc-[ab]\/v1\/chat\/completions$/.test(req.url)) {
        res.writeHead(404).end(); return
      }
      requests.push({ path: req.url, body })
      const user = body.messages.findLast(message => message.role === 'user')
      const content = typeof user?.content === 'string' ? user.content : user?.content?.filter(part => part.type === 'text').map(part => part.text).join('\n')
      // OpenCode may append reminders to input. Only this explicit fixture marker controls the stub.
      const marker = content?.match(/POC_ACTION:(\{[^\n]*\})/)
      const action = marker ? JSON.parse(marker[1]) : { reply: 'fixture auxiliary response' }
      if (action.hold) {
        held.add(res)
        res.on('close', () => { held.delete(res); disconnected++ })
        return
      }
      const lastTool = body.messages.at(-1)?.role === 'tool'
      const call = action.tool && !lastTool
      const delta = call ? {
        role: 'assistant', tool_calls: [{ index: 0, id: `call_${randomUUID()}`, type: 'function',
          function: { name: `capability_${action.tool}`, arguments: JSON.stringify(action.args) } }],
      } : { role: 'assistant', content: action.reply || 'fixture completed' }
      const base = { id: `chatcmpl-${randomUUID()}`, object: 'chat.completion.chunk', created: 1, model: body.model }
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta, finish_reason: null }] })}\n\n`)
      res.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, delta: {}, finish_reason: call ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })}\n\n`)
      res.end('data: [DONE]\n\n')
    } catch (error) {
      res.writeHead(500).end(JSON.stringify({ error: error.message }))
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return {
    baseURL: `http://127.0.0.1:${server.address().port}`, tokens, dispatch, observe, drafts, requests, held,
    disconnected: () => disconnected,
    async close() {
      for (const res of held) res.destroy()
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    },
  }
}
