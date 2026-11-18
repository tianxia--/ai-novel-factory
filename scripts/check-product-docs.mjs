import assert from "node:assert/strict"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../", import.meta.url))
const productRoot = path.join(root, "docs/product")
const registry = JSON.parse(readFileSync(path.join(productRoot, "releases.json"), "utf8"))
assert.equal(registry.registryVersion, "1.0")
assert.ok(Array.isArray(registry.platform) && Array.isArray(registry.capabilities))

const ids = new Set()
const platformVersions = registry.platform.map(release => release.version)
assert.equal(new Set(platformVersions).size, platformVersions.length, "Duplicate platform version")
let requirementCount = 0
let caseCount = 0

for (const release of [...registry.platform, ...registry.capabilities]) {
  const label = `${release.id ?? registry.product}/${release.version}`
  assert.ok(["planned", "implementing", "engineering_verified", "user_accepted", "released"].includes(release.status), `${label}: invalid status`)
  assert.ok(["pending", "accepted", "changes_requested"].includes(release.acceptanceStatus), `${label}: invalid acceptance status`)
  const documents = Object.fromEntries(["prd", "plan", "acceptance"].map(key => {
    assert.equal(typeof release[key], "string", `${label}: missing ${key}`)
    const file = path.resolve(productRoot, release[key])
    assert.ok(file.startsWith(productRoot + path.sep), `${label}: document outside product directory`)
    return [key, readFileSync(file, "utf8")]
  }))
  const requirementRows = [...documents.prd.matchAll(/^\|\s*([PN]\d{2}-R\d{2})\s*\|([^\n]+)$/gm)]
  const acceptanceRows = [...documents.acceptance.matchAll(/^\|\s*([PN]\d{2}-A\d{2})\s*\|\s*([^|]+)\|/gm)]
  assert.ok(requirementRows.length > 0 && acceptanceRows.length > 0, `${label}: empty requirements or acceptance`)
  assert.deepEqual(requirementRows.map(row => row[1]).sort(), [...release.requirements].sort(), `${label}: PRD registry mismatch`)
  assert.deepEqual(acceptanceRows.map(row => row[1]).sort(), [...release.cases].sort(), `${label}: acceptance registry mismatch`)
  const covered = new Set()
  for (const row of acceptanceRows) {
    const references = row[2].match(/[PN]\d{2}-R\d{2}/g) ?? []
    assert.ok(references.length > 0, `${row[1]}: no requirement reference`)
    for (const id of references) {
      assert.ok(release.requirements.includes(id), `${row[1]}: unknown requirement ${id}`)
      covered.add(id)
    }
  }
  for (const [id, cells] of requirementRows.map(row => [row[1], row[2]])) {
    assert.ok(covered.has(id), `${id}: no acceptance coverage`)
    assert.ok(documents.plan.includes(id), `${id}: missing implementation mapping`)
    const references = cells.match(/[PN]\d{2}-A\d{2}/g) ?? []
    assert.ok(references.length > 0 && references.every(value => release.cases.includes(value)), `${id}: invalid case mapping`)
  }
  for (const id of [...release.requirements, ...release.cases]) {
    assert.ok(!ids.has(id), `Duplicate ID: ${id}`)
    ids.add(id)
  }
  if (["engineering_verified", "user_accepted", "released"].includes(release.status)) {
    assert.equal(typeof release.evidenceRecord, "string", `${label}: verified release has no evidence record`)
    assert.ok(existsSync(path.resolve(productRoot, release.evidenceRecord)), `${label}: missing evidence record`)
  }
  if (["user_accepted", "released"].includes(release.status)) {
    assert.equal(release.acceptanceStatus, "accepted", `${label}: user acceptance missing`)
  }
  for (const dependency of release.dependsOn ?? []) {
    assert.ok(platformVersions.includes(dependency), `${label}: unknown dependency`)
    assert.ok(platformVersions.indexOf(dependency) < platformVersions.indexOf(release.version), `${label}: dependency order`)
  }
  if (release.integrationPlatform) {
    assert.ok(platformVersions.includes(release.integrationPlatform), `${label}: unknown integration platform`)
    assert.equal(release.standaloneRequiresPlatform, false, `${label}: capability must be independent`)
  }
  requirementCount += requirementRows.length
  caseCount += acceptanceRows.length
}

const pendingDirectories = [productRoot, path.join(root, "docs/architecture"), path.join(root, "docs/im")]
const files = [path.join(root, "README.md")]
while (pendingDirectories.length) {
  const directory = pendingDirectories.pop()
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) pendingDirectories.push(file)
    else if (entry.isFile() && /\.(md|json)$/.test(entry.name)) files.push(file)
  }
}

let linkCount = 0
let jsonCount = 0
for (const file of files) {
  const source = readFileSync(file, "utf8")
  assert.ok(!/[ \t]+$/m.test(source), `${file}: trailing whitespace`)
  if (file.endsWith(".json")) {
    JSON.parse(source)
    jsonCount++
    continue
  }
  assert.equal((source.match(/^```/gm) ?? []).length % 2, 0, `${file}: unclosed code fence`)
  for (const match of source.matchAll(/\[[^\]\n]*\]\(([^)\n]+)\)/g)) {
    if (/^https?:/.test(match[1])) continue
    const [target, anchor] = decodeURIComponent(match[1]).split("#")
    const destination = target ? path.resolve(path.dirname(file), target) : file
    assert.ok(existsSync(destination), `${file}: missing ${match[1]}`)
    if (anchor) {
      const headings = [...readFileSync(destination, "utf8").matchAll(/^#+ (.+)$/gm)]
        .map(row => row[1].toLowerCase().replace(/[^\p{L}\p{N}_\s-]/gu, "").replace(/ /g, "-"))
      assert.ok(headings.includes(anchor), `${file}: missing anchor ${match[1]}`)
    }
    linkCount++
  }
}

const roadmap = readFileSync(path.join(productRoot, "roadmap.md"), "utf8")
for (let index = 1; index <= 24; index++) {
  const id = `IM-${String(index).padStart(2, "0")}`
  assert.ok(roadmap.includes(id), `Legacy requirement missing from roadmap: ${id}`)
}

console.log(JSON.stringify({
  platformVersions: registry.platform.length,
  capabilityVersions: registry.capabilities.length,
  requirements: requirementCount,
  acceptanceCases: caseCount,
  markdownFiles: files.length - jsonCount,
  localLinks: linkCount,
  jsonFiles: jsonCount,
  result: "passed",
}, null, 2))
