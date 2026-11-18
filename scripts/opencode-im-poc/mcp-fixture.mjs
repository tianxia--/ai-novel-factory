// Test-only MCP peer. Real capabilities will be served by the application.
import { createInterface } from 'node:readline'

const [baseURL, actor] = process.argv.slice(2)
const token = process.env.POC_CAPABILITY_TOKEN
const tools = [
  {
    name: 'send_message', description: 'Send a message to a conversation you belong to.',
    inputSchema: { type: 'object', properties: {
      conversation: { type: 'string' }, text: { type: 'string' },
    }, required: ['conversation', 'text'], additionalProperties: false },
  },
  ...(actor === 'writer' ? [{
    name: 'write_draft', description: 'Store a private draft owned by the authenticated writer.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false },
  }] : []),
]

for await (const line of createInterface({ input: process.stdin })) {
  const message = JSON.parse(line)
  if (message.id === undefined) continue
  try {
    let result
    if (message.method === 'initialize') result = {
      protocolVersion: message.params.protocolVersion,
      capabilities: { tools: {} }, serverInfo: { name: 'im-poc-fixture', version: '1.0.0' },
    }
    else if (message.method === 'ping') result = {}
    else if (message.method === 'tools/list') result = { tools }
    else if (message.method === 'tools/call') {
      const response = await fetch(`${baseURL}/capability`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(message.params), signal: AbortSignal.timeout(5_000),
      })
      result = { content: [{ type: 'text', text: await response.text() }], isError: !response.ok }
    } else throw new Error(`Unsupported method: ${message.method}`)
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, result })}\n`)
  } catch (error) {
    process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: error.message } })}\n`)
  }
}
