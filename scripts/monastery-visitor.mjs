import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const AGENTS_MD_PATH = path.join(ROOT, 'AGENTS.md')

console.log('[MONASTERY] taso-proxy pre-visitation\n')

if (!fs.existsSync(AGENTS_MD_PATH)) {
  console.error('AGENTS.md missing')
  process.exit(1)
}
const wordCount = fs.readFileSync(AGENTS_MD_PATH, 'utf8').trim().split(/\s+/).length
console.log(`AGENTS.md ${wordCount} words / 1500 cap`)
if (wordCount > 1500) {
  console.error('AGENTS.md exceeds 1500 words')
  process.exit(1)
}

execSync('npm test', { stdio: 'inherit', cwd: ROOT })
execSync('npm run typecheck', { stdio: 'inherit', cwd: ROOT })

const neighbors = path.join(ROOT, 'scripts/check-neighbors.mjs')
if (fs.existsSync(neighbors)) {
  execSync('node scripts/check-neighbors.mjs', { stdio: 'inherit', cwd: ROOT })
}

console.log('\nvisit gate passed')
