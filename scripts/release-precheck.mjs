import {
  readdirSync,
  readFileSync,
} from 'node:fs'
import {
  dirname,
  resolve,
} from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

/**
 * @typedef {'error' | 'warning'} PrecheckLevel
 *
 * @typedef {object} PrecheckIssue
 * @property {PrecheckLevel} level 问题级别，error 会阻断发版流程
 * @property {string} code 问题唯一标识码
 * @property {string} message 面向开发者的具体问题描述
 *
 * @typedef {object} PrecheckPayload
 * @property {Record<string, unknown>} pluginJson 解析后的 plugin.json 内容
 * @property {Record<string, unknown>} packageJson 解析后的 package.json 内容
 * @property {Record<string, unknown>} i18nZh 解析后的中文语言包内容
 * @property {Record<string, unknown>} i18nEn 解析后的英文语言包内容
 * @property {Set<string>} docsFiles 工作区顶层文件名集合，用于校验 readme 指向的文件是否存在
 */

/**
 * @param {unknown} value
 * @returns {string} 非字符串时返回空字符串，否则返回去除首尾空白后的结果
 */
function readString(value) {
  if (typeof value !== 'string') {
    return ''
  }
  return value.trim()
}

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>} 传入对象时原样返回，否则返回空对象
 */
function toObject(value) {
  return value && typeof value === 'object' ? /** @type {Record<string, unknown>} */ (value) : {}
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

function collectTopLevelFiles(workspaceRoot) {
  const entries = readdirSync(workspaceRoot, { withFileTypes: true })
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
  return new Set(files)
}

function collectRedundantEnUsMetadataFields(pluginJson) {
  return ['displayName', 'description', 'readme']
    .filter((field) => Object.hasOwn(toObject(pluginJson[field]), 'en_US'))
    .map((field) => `${field}.en_US`)
}

/**
 * @param {PrecheckPayload} payload
 * @returns {PrecheckIssue[]} 检查发现的问题列表，全部通过时为空数组
 */
export function collectPrecheckIssues(payload) {
  /** @type {PrecheckIssue[]} */
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
  const zhOnlyKeys = [...zhKeys].filter((key) => !enKeys.has(key))
  const enOnlyKeys = [...enKeys].filter((key) => !zhKeys.has(key))
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

  const displayNameMap = toObject(payload.pluginJson.displayName)
  const expectedDisplayNameDefault = readString(payload.i18nEn.addTopBarIcon) || readString(displayNameMap.en_US)
  const displayNameDefault = readString(displayNameMap.default)
  if (expectedDisplayNameDefault && displayNameDefault && displayNameDefault !== expectedDisplayNameDefault) {
    issues.push({
      code: 'display_name_default_mismatch',
      level: 'error',
      message: `plugin.json displayName.default 应与英文标题一致：当前为 ${displayNameDefault}，期望为 ${expectedDisplayNameDefault}`,
    })
  }

  const descriptionMap = toObject(payload.pluginJson.description)
  const descriptionDefault = readString(descriptionMap.default)
  const descriptionEn = readString(descriptionMap.en_US)
  if (descriptionDefault && descriptionEn && descriptionDefault !== descriptionEn) {
    issues.push({
      code: 'description_default_mismatch',
      level: 'error',
      message: 'plugin.json description.default 应与英文描述一致',
    })
  }

  const readmeMap = toObject(payload.pluginJson.readme)
  const readmeDefault = readString(readmeMap.default)
  const readmeEn = readString(readmeMap.en_US)
  if (readmeDefault && readmeEn && readmeDefault !== readmeEn) {
    issues.push({
      code: 'readme_default_mismatch',
      level: 'error',
      message: `plugin.json readme.default 应指向英文 README：当前为 ${readmeDefault}，期望为 ${readmeEn}`,
    })
  }

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

  const redundantEnUsFields = collectRedundantEnUsMetadataFields(payload.pluginJson)
  if (redundantEnUsFields.length > 0) {
    issues.push({
      code: 'redundant_en_us_metadata',
      level: 'error',
      message: `plugin.json 不应包含多余的 en_US 字段：${redundantEnUsFields.join(', ')}`,
    })
  }

  return issues
}

export function getReleaseStaticCopyTargets() {
  return [
    {
      src: './README*.md',
      dest: './',
    },
    {
      src: './icon.*',
      dest: './',
    },
    {
      src: './preview.*',
      dest: './',
    },
    {
      src: './plugin.json',
      dest: './',
    },
    {
      src: './src/i18n/*.json',
      dest: './i18n/',
      // vite-plugin-static-copy v2+ 默认保留源目录层级（structured），
      // stripBase: true 确保语言包扁平落在 i18n/ 根下
      rename: { stripBase: true },
    },
  ]
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

  if (issues.some((issue) => issue.level === 'error')) {
    process.exitCode = 1
  }
}
