import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

export async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

export async function createHarness(config) {
  const port = await freePort()
  const root = await mkdtemp(join(tmpdir(), 'opencode-im-poc-'))
  const work = join(root, 'work')
  await mkdir(work)
  const password = randomBytes(24).toString('hex')
  let child
  let logs = ''
  const env = {
    PATH: process.env.PATH,
    HOME: root,
    TMPDIR: root,
    XDG_CONFIG_HOME: join(root, 'config'),
    XDG_DATA_HOME: join(root, 'data'),
    XDG_CACHE_HOME: join(root, 'cache'),
    XDG_STATE_HOME: join(root, 'state'),
    OPENCODE_CONFIG_CONTENT: JSON.stringify(config),
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
    OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
    OPENCODE_DISABLE_CLAUDE_CODE: '1',
    OPENCODE_DISABLE_MODELS_FETCH: '1',
    OPENCODE_EXPERIMENTAL_DISABLE_FILEWATCHER: '1',
    OPENCODE_SERVER_PASSWORD: password,
    OPENCODE_SERVER_USERNAME: 'poc',
  }

  async function api(path, body, method = body === undefined ? 'GET' : 'POST', timeout = 30_000) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: {
        authorization: `Basic ${Buffer.from(`poc:${password}`).toString('base64')}`,
        'content-type': 'application/json',
        'x-opencode-directory': work,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    })
    const value = await response.text()
    if (!response.ok) throw new Error(`${method} ${path}: ${response.status} ${value}`)
    return value ? JSON.parse(value) : null
  }

  async function start() {
    child = spawn(process.env.OPENCODE_POC_BIN || 'opencode', [
      'serve', '--hostname', '127.0.0.1', '--port', String(port),
    ], { cwd: work, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    let spawnError
    child.on('error', error => { spawnError = error })
    child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-16_000) })
    child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-16_000) })
    for (let i = 0; i < 200; i++) {
      if (spawnError) throw spawnError
      if (child.exitCode !== null) throw new Error(`OpenCode exited: ${logs}`)
      try { return await api('/global/health', undefined, 'GET', 1_000) } catch {}
      await delay(100)
    }
    throw new Error(`OpenCode startup timed out: ${logs}`)
  }

  async function stop() {
    if (!child?.pid) return
    const exited = once(child, 'exit').catch(() => {})
    // The npm launcher can spawn a native child; terminate the whole test group.
    try { process.kill(-child.pid, 'SIGTERM') } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
    await Promise.race([exited, delay(2_000)])
    if (child.exitCode === null && child.signalCode === null) {
      process.kill(-child.pid, 'SIGKILL')
      await exited
    }
    child = undefined
  }

  return {
    api, start, stop, root,
    logs: () => logs,
    async close() { await stop(); await rm(root, { recursive: true, force: true }) },
  }
}
