import fs from "node:fs/promises"
import path from "node:path"
import http from "node:http"

import {
  advanceAutonomousProject,
  createManagedAutonomousProject,
  initAutonomousProject,
  listAutonomousProjects,
  loadAutonomousState,
  prepareCoverGeneration,
  resolveManagedProjectRoot,
  reviewInterruption,
} from "./orchestrator"
import { runMultiAgentDiscussion } from "./discussion"
import { testProviderConnectivity } from "./runtime-llm"
import { getProjectEnvStatus, upsertProjectEnvValues } from "./env-manager"

interface ServerOptions {
  rootDir?: string
  port?: number
  staticDir?: string
}

interface ApiCallOptions {
  projectId?: string | null
  onStreamEvent?: (event: { role: string; content: string }) => void | Promise<void>
  onAgentStreamEvent?: (
    event:
      | { type: "agent_start"; turnId: string; role: string }
      | { type: "agent_delta"; turnId: string; role: string; delta: string }
      | { type: "agent_complete"; turnId: string; role: string; content: string },
  ) => void | Promise<void>
}

function json(response: http.ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" })
  response.end(JSON.stringify(payload))
}

export function writeServerErrorResponse(
  response: Pick<http.ServerResponse, "headersSent" | "writableEnded" | "writeHead" | "write" | "end">,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : String(error)

  if (response.headersSent) {
    if (!response.writableEnded) {
      response.write(`event: error\n`)
      response.write(`data: ${JSON.stringify({ error: message })}\n\n`)
      response.end()
    }
    return
  }

  json(response as http.ServerResponse, 500, { error: message })
}

function eventStreamHeaders(response: http.ServerResponse) {
  response.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
  })
}

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim()
  if (!raw) {
    return {}
  }

  return JSON.parse(raw) as Record<string, unknown>
}

function serializeState(state: Awaited<ReturnType<typeof loadAutonomousState>>) {
  return {
    project: state.project,
    runtime: state.runtime,
    reactSetup: state.reactSetup,
    plan: state.plan,
    assets: state.assets,
  }
}

async function readDiscussionTranscript(rootDir: string) {
  try {
    return await fs.readFile(path.join(rootDir, ".ai-novel", "chat", "discussion-log.md"), "utf8")
  } catch {
    return ""
  }
}

async function createWorkspacePayload(projectRoot: string, state?: Awaited<ReturnType<typeof loadAutonomousState>> | null) {
  const resolvedState = state ?? (await tryLoadState(projectRoot))

  return {
    state: resolvedState ? serializeState(resolvedState) : null,
    transcript: await readDiscussionTranscript(projectRoot),
  }
}

async function tryLoadState(projectRoot: string) {
  try {
    return await loadAutonomousState(projectRoot)
  } catch {
    return null
  }
}

async function resolveProjectContext(rootDir: string, projectId?: string | null) {
  const projects = await listAutonomousProjects(rootDir)

  if (projectId) {
    return {
      projects,
      projectId,
      projectRoot: await resolveManagedProjectRoot(rootDir, projectId),
      mode: "managed" as const,
    }
  }

  if (projects.length === 1) {
    return {
      projects,
      projectId: projects[0].id,
      projectRoot: projects[0].projectRoot,
      mode: "managed" as const,
    }
  }

  if (projects.length > 1) {
    return {
      projects,
      projectId: null,
      projectRoot: null,
      mode: "selection_required" as const,
    }
  }

  const legacyState = await tryLoadState(rootDir)
  if (legacyState) {
    return {
      projects: [],
      projectId: "legacy-root-workspace",
      projectRoot: rootDir,
      mode: "legacy" as const,
    }
  }

  return {
    projects,
    projectId: null,
    projectRoot: null,
    mode: "empty" as const,
  }
}

export async function handleNovelStudioApi(
  rootDir: string,
  method: string,
  pathname: string,
  body: Record<string, unknown> = {},
  options: ApiCallOptions = {},
) {
  if (method === "GET" && pathname === "/api/projects") {
    return {
      status: 200,
      payload: {
        projects: await listAutonomousProjects(rootDir),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/projects") {
    const idea = String(body.idea || "").trim()
    const totalChapters = Number.parseInt(String(body.chapters || "24"), 10)
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || "2500"), 10)

    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } }
    }

    const created = await createManagedAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : undefined,
    })
    const kickoffMessage = [
      `请基于小说想法“${created.state.project.idea}”直接接管创作流程。`,
      `先完成世界观基线、主角核心、主线方向的首轮统一讨论。`,
      `目标总章数：${created.state.plan.totalChapters}，单章字数：${created.state.plan.chapterWordTarget}。`,
      "不要向我提问选项，缺失信息请自行建立高质量工作假设，并给出统一结论。",
    ].join("")
    const discussion = await runMultiAgentDiscussion(created.project.projectRoot, kickoffMessage)
    const kickoffState = await loadAutonomousState(created.project.projectRoot)

    return {
      status: 200,
      payload: {
        projectId: created.project.id,
        projects: await listAutonomousProjects(rootDir),
        discussion,
        ...(await createWorkspacePayload(created.project.projectRoot, kickoffState)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "GET" && pathname === "/api/status") {
    const context = await resolveProjectContext(rootDir, options.projectId)
    if (context.mode === "selection_required") {
      return {
        status: 409,
        payload: {
          error: "project_selection_required",
          projects: context.projects,
          envStatus: getProjectEnvStatus(rootDir),
        },
      }
    }

    if (!context.projectRoot) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getProjectEnvStatus(rootDir),
        },
      }
    }

    const state = await tryLoadState(context.projectRoot)
    if (!state) {
      return {
        status: 404,
        payload: {
          error: "workspace_not_initialized",
          transcript: "",
          projects: context.projects,
          envStatus: getProjectEnvStatus(rootDir),
        },
      }
    }

    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/init") {
    const idea = String(body.idea || "").trim()
    const totalChapters = Number.parseInt(String(body.chapters || "24"), 10)
    const chapterWordTarget = Number.parseInt(String(body.chapterWords || "2500"), 10)

    if (!idea) {
      return { status: 400, payload: { error: "idea_required" } }
    }

    const state = await initAutonomousProject({
      rootDir,
      idea,
      totalChapters,
      chapterWordTarget,
      title: typeof body.title === "string" ? body.title : undefined,
    })

    return { status: 200, payload: await createWorkspacePayload(rootDir, state) }
  }

  if (method === "POST" && pathname === "/api/advance") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getProjectEnvStatus(rootDir) } }
    }
    const state = await advanceAutonomousProject(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/cover") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getProjectEnvStatus(rootDir) } }
    }
    const state = await prepareCoverGeneration(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/provider-test") {
    const result = await testProviderConnectivity({
      baseUrl: typeof body.LLM_BASE_URL === "string" ? body.LLM_BASE_URL : undefined,
      apiKey: typeof body.LLM_API_KEY === "string" ? body.LLM_API_KEY : undefined,
      modelName: typeof body.LLM_MODEL_ID === "string" ? body.LLM_MODEL_ID : undefined,
    })
    const state = await tryLoadState(rootDir)
    return {
      status: 200,
      payload: {
        result,
        ...(await createWorkspacePayload(rootDir, state)),
      },
    }
  }

  if (method === "GET" && pathname === "/api/env") {
    return {
      status: 200,
      payload: {
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/env") {
    const updates = Object.fromEntries(
      Object.entries(body).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0,
      ),
    )

    if (Object.keys(updates).length > 0) {
      upsertProjectEnvValues(rootDir, updates)
    }

    return {
      status: 200,
      payload: {
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/interrupt") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getProjectEnvStatus(rootDir) } }
    }
    const message = String(body.message || "").trim()
    if (!message) {
      return { status: 400, payload: { error: "message_required" } }
    }

    await reviewInterruption({ rootDir: context.projectRoot, message })
    const state = await loadAutonomousState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        ...(await createWorkspacePayload(context.projectRoot, state)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/chat") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getProjectEnvStatus(rootDir) } }
    }
    const message = String(body.message || "").trim()
    if (!message) {
      return { status: 400, payload: { error: "message_required" } }
    }

    const discussion = await runMultiAgentDiscussion(context.projectRoot, message)
    const state = await loadAutonomousState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        discussion,
        ...(await createWorkspacePayload(context.projectRoot, state)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  if (method === "POST" && pathname === "/api/chat-stream") {
    const context = await resolveProjectContext(rootDir, options.projectId ?? (typeof body.projectId === "string" ? body.projectId : null))
    if (!context.projectRoot) {
      return { status: 404, payload: { error: "project_required", projects: context.projects, envStatus: getProjectEnvStatus(rootDir) } }
    }
    const message = String(body.message || "").trim()
    if (!message) {
      return { status: 400, payload: { error: "message_required" } }
    }

    const streamed: Array<{ role: string; content: string }> = []
    const discussion = await runMultiAgentDiscussion(context.projectRoot, message, {
      onStreamEvent: async (event) => {
        await options.onAgentStreamEvent?.(event)
      },
      onEvent: async (event) => {
        streamed.push(event)
        await options.onStreamEvent?.(event)
      },
    })

    const state = await loadAutonomousState(context.projectRoot)
    return {
      status: 200,
      payload: {
        activeProjectId: context.projectId,
        projects: context.projects,
        events: streamed,
        discussion,
        ...(await createWorkspacePayload(context.projectRoot, state)),
        envStatus: getProjectEnvStatus(rootDir),
      },
    }
  }

  return { status: 404, payload: { error: "not_found" } }
}

function resolveStaticFile(staticDir: string, pathname: string) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "")
  return path.join(staticDir, relative)
}

async function serveStatic(staticDir: string, pathname: string, response: http.ServerResponse) {
  const filePath = resolveStaticFile(staticDir, pathname)
  try {
    const content = await fs.readFile(filePath)
    const ext = path.extname(filePath).toLowerCase()
    const contentType =
      ext === ".html"
        ? "text/html; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : ext === ".js" || ext === ".mjs"
            ? "application/javascript; charset=utf-8"
            : ext === ".json"
              ? "application/json; charset=utf-8"
              : "application/octet-stream"

    response.writeHead(200, { "content-type": contentType })
    response.end(content)
    return true
  } catch {
    return false
  }
}

export async function startNovelStudioServer(options: ServerOptions = {}) {
  const rootDir = options.rootDir ?? process.cwd()
  const staticDir = options.staticDir

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1")
      const pathname = url.pathname
      const queryProjectId = url.searchParams.get("projectId")

      if (request.method === "GET" && pathname === "/api/projects") {
        const result = await handleNovelStudioApi(rootDir, "GET", "/api/projects")
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/projects") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/projects", body)
        return json(response, result.status, result.payload)
      }

      if (request.method === "GET" && pathname === "/api/status") {
        const result = await handleNovelStudioApi(rootDir, "GET", "/api/status", {}, { projectId: queryProjectId })
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/init") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/init", body)
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/advance") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/advance", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
        })
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/cover") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/cover", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
        })
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/provider-test") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/provider-test", body)
        return json(response, result.status, result.payload)
      }

      if (request.method === "GET" && pathname === "/api/env") {
        const result = await handleNovelStudioApi(rootDir, "GET", "/api/env")
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/env") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/env", body)
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/interrupt") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/interrupt", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
        })
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/chat") {
        const body = await readJsonBody(request)
        const result = await handleNovelStudioApi(rootDir, "POST", "/api/chat", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
        })
        return json(response, result.status, result.payload)
      }

      if (request.method === "POST" && pathname === "/api/chat-stream") {
        const body = await readJsonBody(request)
        eventStreamHeaders(response)

        const result = await handleNovelStudioApi(rootDir, "POST", "/api/chat-stream", body, {
          projectId: typeof body.projectId === "string" ? body.projectId : queryProjectId,
          onAgentStreamEvent: async (event) => {
            response.write(`event: ${event.type}\n`)
            response.write(`data: ${JSON.stringify(event)}\n\n`)
          },
        })
        response.write(`event: complete\n`)
        response.write(`data: ${JSON.stringify(result.payload)}\n\n`)
        response.end()
        return
      }

      if (staticDir && request.method === "GET") {
        const served = await serveStatic(staticDir, pathname, response)
        if (served) {
          return
        }
      }

      json(response, 404, { error: "not_found" })
    } catch (error) {
      writeServerErrorResponse(response, error)
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(options.port ?? 0, "127.0.0.1", () => resolve())
  })

  const address = server.address()
  const port = typeof address === "object" && address ? address.port : options.port ?? 0

  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error)
            return
          }
          resolve()
        })
      }),
  }
}

async function runCliServer() {
  const args = process.argv.slice(2)
  const flags = new Map<string, string>()

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith("--")) {
      continue
    }

    const key = token.slice(2)
    const next = args[index + 1]
    if (!next || next.startsWith("--")) {
      flags.set(key, "true")
      continue
    }
    flags.set(key, next)
    index += 1
  }

  const rootDir = flags.get("root-dir") || process.cwd()
  const staticDir = flags.get("static-dir")
  const port = flags.get("port") ? Number.parseInt(flags.get("port") || "4310", 10) : 4310

  const { port: actualPort } = await startNovelStudioServer({
    rootDir,
    staticDir,
    port,
  })

  console.log(`AI Novel Studio server listening on http://127.0.0.1:${actualPort}`)
}

if (process.argv[1] && process.argv[1].includes("server")) {
  runCliServer().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
