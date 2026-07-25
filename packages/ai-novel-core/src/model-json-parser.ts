export interface JsonStructureRepair {
  offset: number
  line: number
  column: number
  found: "}" | "]"
  expected: "}" | "]"
  context: string
}

export interface ParsedModelJsonObject {
  value: Record<string, unknown>
  repairedText: string | null
  repairs: JsonStructureRepair[]
  originalError: string | null
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function assertJsonObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("model_response_json_must_be_an_object")
  }
  return value as Record<string, unknown>
}

function extractJsonCandidate(raw: string) {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu)?.[1]?.trim()
  if (fenced) return fenced
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error("model_response_did_not_contain_json")
  return trimmed.slice(start, end + 1)
}

function repairMismatchedClosers(candidate: string) {
  const chars = candidate.split("")
  const expectedClosers: Array<"}" | "]"> = []
  const repairs: JsonStructureRepair[] = []
  let inString = false
  let escaped = false
  let line = 1
  let column = 1

  for (let offset = 0; offset < chars.length; offset += 1) {
    const char = chars[offset]
    if (inString) {
      if (escaped) escaped = false
      else if (char === "\\") escaped = true
      else if (char === '"') inString = false
    } else if (char === '"') {
      inString = true
    } else if (char === "{") {
      expectedClosers.push("}")
    } else if (char === "[") {
      expectedClosers.push("]")
    } else if (char === "}" || char === "]") {
      const expected = expectedClosers.at(-1)
      if (expected) {
        expectedClosers.pop()
        if (char !== expected) {
          repairs.push({
            offset,
            line,
            column,
            found: char,
            expected,
            context: candidate.slice(Math.max(0, offset - 60), Math.min(candidate.length, offset + 61)),
          })
          chars[offset] = expected
        }
      }
    }

    if (char === "\n") {
      line += 1
      column = 1
    } else {
      column += 1
    }
  }

  return { text: chars.join(""), repairs }
}

export function parseModelJsonObject(raw: string): ParsedModelJsonObject {
  const candidate = extractJsonCandidate(raw)
  try {
    return {
      value: assertJsonObject(JSON.parse(candidate)),
      repairedText: null,
      repairs: [],
      originalError: null,
    }
  } catch (error) {
    const originalError = errorMessage(error)
    const repaired = repairMismatchedClosers(candidate)
    if (!repaired.repairs.length) {
      throw new Error(`model_response_invalid_json: ${originalError}`)
    }
    try {
      return {
        value: assertJsonObject(JSON.parse(repaired.text)),
        repairedText: repaired.text,
        repairs: repaired.repairs,
        originalError,
      }
    } catch (repairError) {
      throw new Error(`model_response_invalid_json: ${originalError}; structural_repair_failed: ${errorMessage(repairError)}`)
    }
  }
}
