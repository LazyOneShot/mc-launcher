import * as fs from 'fs-extra'
import * as path from 'path'
import * as os from 'os'
import { spawnSync } from 'child_process'

export interface JavaInstall {
  path: string           // full path to javaw.exe (or java on non-Windows)
  majorVersion: number   // 8, 17, 21, etc.
  vendor?: string
}

/**
 * Determine which Java major version an MC version needs.
 * Based on Mojang's official Java requirements.
 */
export function requiredJavaForMc(mcVersion: string): number {
  const parts = mcVersion.split('.').map(n => parseInt(n, 10))
  const minor = parts[1] || 0
  const patch = parts[2] || 0

  // 1.20.5+ requires Java 21
  if (minor > 20 || (minor === 20 && patch >= 5)) return 21
  // 1.17+ requires Java 17
  if (minor >= 17) return 17
  // 1.16 and older use Java 8
  return 8
}

/**
 * Find the major version of a Java install by running it with -version.
 * Falls back to parsing the folder name if the process fails.
 */
function detectMajorVersion(javaExe: string): number | null {
  try {
    const result = spawnSync(javaExe, ['-version'], { encoding: 'utf-8', timeout: 5000 })
    // Java prints version info to stderr, not stdout
    const output = (result.stderr || '') + (result.stdout || '')
    // Match "version \"21.0.5\"" or "version \"1.8.0_301\""
    const match = output.match(/version "([\d._]+)"/)
    if (match) {
      const parts = match[1].split('.')
      // "1.8.0..." -> Java 8, otherwise the first number is the major
      const major = parseInt(parts[0] === '1' ? parts[1] : parts[0], 10)
      if (!isNaN(major)) return major
    }
  } catch {}

  // Fall back to parsing "jdk-21.0.11.10-hotspot" style folder names
  const folder = path.basename(path.dirname(path.dirname(javaExe)))
  const folderMatch = folder.match(/(?:jdk|jre)-(\d+)/)
  if (folderMatch) return parseInt(folderMatch[1], 10)

  return null
}

/**
 * Search common install locations for Java executables.
 */
export async function findAllJavaInstalls(): Promise<JavaInstall[]> {
  const exe = process.platform === 'win32' ? 'javaw.exe' : 'java'
  const found: JavaInstall[] = []

  const searchRoots: string[] = []

  if (process.platform === 'win32') {
    searchRoots.push(
      'C:\\Program Files\\Eclipse Adoptium',
      'C:\\Program Files\\Java',
      'C:\\Program Files\\Zulu',
      'C:\\Program Files\\Microsoft\\jdk',
      'C:\\Program Files\\Amazon Corretto',
      'C:\\Program Files (x86)\\Eclipse Adoptium',
      'C:\\Program Files (x86)\\Java',
      path.join(process.env.LOCALAPPDATA || '', 'Programs\\Eclipse Adoptium'),
      path.join(process.env.APPDATA || '', '.minecraft\\runtime')
    )
  } else if (process.platform === 'darwin') {
    searchRoots.push('/Library/Java/JavaVirtualMachines', path.join(os.homedir(), 'Library/Java/JavaVirtualMachines'))
  } else {
    searchRoots.push('/usr/lib/jvm', '/opt/java', path.join(os.homedir(), '.sdkman/candidates/java'))
  }

  for (const root of searchRoots) {
    if (!(await fs.pathExists(root))) continue

    try {
      const entries = await fs.readdir(root)
      for (const entry of entries) {
        // Try common relative paths to the executable
        const candidates = [
          path.join(root, entry, 'bin', exe),
          path.join(root, entry, 'jre', 'bin', exe),                        // some JDKs have a nested jre
          path.join(root, entry, 'Contents', 'Home', 'bin', exe),           // macOS bundle
        ]
        for (const candidate of candidates) {
          if (await fs.pathExists(candidate)) {
            const major = detectMajorVersion(candidate)
            if (major) {
              found.push({ path: candidate, majorVersion: major })
            }
            break
          }
        }
      }
    } catch {}
  }

  // Dedupe by real path
  const seen = new Set<string>()
  return found.filter(j => {
    if (seen.has(j.path)) return false
    seen.add(j.path)
    return true
  })
}

/**
 * Pick the best Java install for a given MC version.
 * Prefers exact major-version match, then any higher version, then any at all.
 */
export async function pickBestJava(mcVersion: string): Promise<JavaInstall | null> {
  const required = requiredJavaForMc(mcVersion)
  const installs = await findAllJavaInstalls()
  if (installs.length === 0) return null

  // Exact match (e.g. Java 21 for a 1.21+ pack)
  const exact = installs.find(j => j.majorVersion === required)
  if (exact) return exact

  // Any newer version — Minecraft is generally forward-compatible
  const newer = installs
    .filter(j => j.majorVersion > required)
    .sort((a, b) => a.majorVersion - b.majorVersion)[0]  // pick the lowest that still works
  if (newer) return newer

  // Fallback: newest available (may crash but nothing else to try)
  return installs.sort((a, b) => b.majorVersion - a.majorVersion)[0]
}
