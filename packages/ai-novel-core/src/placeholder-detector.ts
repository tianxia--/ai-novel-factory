export interface PlaceholderValueHit {
  path: string
  token: string
  value: string
}

const exactPlaceholder = /^(待定|暂无|未命名|后续补充|自行补充|TBD|XXX)$/iu
const trailingPlaceholder = /(?:姓名|名称|身份|地点|时间|内容|设定|关系|结局|原因|目标|代价|规则|势力|角色|人选|章节|范围|窗口|效果|问题|答案|事实|冲突|历史|社会|地理|时代).{0,16}?(待定|暂无|未命名|后续补充|自行补充|TBD|XXX)[。.!！?？]*$/iu
const negatedPlaceholder = /(?:禁止|不得|不能|避免|无任何|没有|不允许|不应|拒绝).{0,24}(?:待定|暂无|未命名|后续补充|自行补充|TBD|XXX)/iu

function placeholderToken(value: string) {
  const normalized = value.trim()
  const exact = normalized.match(exactPlaceholder)?.[1]
  if (exact) return exact
  if (negatedPlaceholder.test(normalized)) return null
  return normalized.match(trailingPlaceholder)?.[1] || null
}

export function findPlaceholderValues(value: unknown, path = "result") {
  const hits: PlaceholderValueHit[] = []
  const visit = (current: unknown, currentPath: string) => {
    if (typeof current === "string") {
      const token = placeholderToken(current)
      if (token) hits.push({ path: currentPath, token, value: current })
      return
    }
    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, `${currentPath}[${index}]`))
      return
    }
    if (current && typeof current === "object") {
      for (const [key, item] of Object.entries(current)) visit(item, `${currentPath}.${key}`)
    }
  }
  visit(value, path)
  return hits
}
