import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @typedef {'error' | 'warning'} PrecheckLevel
 *
 * @typedef {object} PrecheckIssue
 * @property {PrecheckLevel} level
 * @property {string} code
 * @property {string} message
 *
 * @typedef {object} PrecheckPayload
 * @property {Record<string, unknown>} pluginJson
 * @property {Record<string, unknown>} packageJson
 * @property {Record<string, unknown>} i18nZh
 * @property {Record<string, unknown>} i18nEn
 * @property {Set<string>} docsFiles
 */

/**
 * @param {PrecheckPayload} payload
 * @returns {PrecheckIssue[]}
 */
export function collectPrecheckIssues(payload) {
  const issues = []
  const pluginVersion = readString(payload.pluginJson.version)
  const packageVersion = readString(payload.packageJson.version)

  if (!pluginVersion) {
    issues.push({
      code: 'missing_plugin_version',
      level: 'error',
      message: 'plugin.json 缺少 version',
    })
  }

  if (!packageVersion) {
    issues.push({
      code: 'missing_package_version',
      level: 'error',
      message: 'package.json 缺少 version',
    })
  }

  if (pluginVersion && packageVersion && pluginVersion !== packageVersion) {
    issues.push({
      code: 'version_mismatch',
      level: 'error',
      message: `版本不一致：plugin.json=${pluginVersion}, package.json=${packageVersion}`,
    })
  }

  const minAppVersion = readString(payload.pluginJson.minAppVersion)
  if (!minAppVersion) {
    issues.push({
      code: 'missing_min_app_version',
      level: 'error',
      message: 'plugin.json 缺少 minAppVersion',
    })
  }

  const zhKeys = new Set(Object.keys(payload.i18nZh))
  const enKeys = new Set(Object.keys(payload.i18nEn))
  const zhOnlyKeys = [...zhKeys].filter(key => !enKeys.has(key))
  const enOnlyKeys = [...enKeys].filter(key => !zhKeys.has(key))
  if (zhOnlyKeys.length || enOnlyKeys.length) {
    const segments = []
    if (zhOnlyKeys.length) {
      segments.push(`仅 zh_CN 存在：${zhOnlyKeys.join(', ')}`)
    }
    if (enOnlyKeys.length) {
      segments.push(`仅 en_US 存在：${enOnlyKeys.join(', ')}`)
    }
    issues.push({
      code: 'i18n_key_mismatch',
      level: 'error',
      message: `i18n 键不一致：${segments.join('；')}`,
    })
  }

  const readmeMap = toObject(payload.pluginJson.readme)
  Object.entries(readmeMap).forEach(([locale, readmePath]) => {
    const value = readString(readmePath)
    if (!value) {
      issues.push({
        code: 'missing_readme_file',
        level: 'error',
        message: `plugin.json readme.${locale} 为空`,
      })
      return
    }

    if (!payload.docsFiles.has(value)) {
      issues.push({
        code: 'missing_readme_file',
        level: 'error',
        message: `readme.${locale} 指向的文件不存在：${value}`,
      })
    }
  })

  return issues
}

export function runPrecheckFromWorkspace(workspaceRoot) {
  const pluginJson = readJson(resolve(workspaceRoot, 'plugin.json'))
  const packageJson = readJson(resolve(workspaceRoot, 'package.json'))
  const i18nZh = readJson(resolve(workspaceRoot, 'src/i18n/zh_CN.json'))
  const i18nEn = readJson(resolve(workspaceRoot, 'src/i18n/en_US.json'))
  const docsFiles = collectTopLevelFiles(workspaceRoot)

  return collectPrecheckIssues({
    docsFiles,
    i18nEn,
    i18nZh,
    packageJson,
    pluginJson,
  })
}

function collectTopLevelFiles(workspaceRoot) {
  const entries = readdirSync(workspaceRoot, { withFileTypes: true })
  const files = entries
    .filter(entry => entry.isFile())
    .map(entry => entry.name)
  return new Set(files)
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function toObject(value) {
  return value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {}
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function readString(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function printIssues(issues) {
  issues.forEach((issue) => {
    const tag = issue.level === 'error' ? '[ERROR]' : '[WARN]'
    console[issue.level === 'error' ? 'error' : 'warn'](`${tag} ${issue.code}: ${issue.message}`)
  })
}

function isExecutedDirectly() {
  return process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
}

if (isExecutedDirectly()) {
  const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const issues = runPrecheckFromWorkspace(workspaceRoot)
  if (issues.length === 0) {
    console.log('Release precheck passed.')
  } else {
    printIssues(issues)
  }

  if (issues.some(issue => issue.level === 'error')) {
    process.exitCode = 1
  }
}

