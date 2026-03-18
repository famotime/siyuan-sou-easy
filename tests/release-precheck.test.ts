import { describe, expect, it } from 'vitest'
import {
  collectPrecheckIssues,
  getReleaseStaticCopyTargets,
} from '../scripts/release-precheck.mjs'

describe('collectPrecheckIssues', () => {
  it('passes when release metadata is consistent', () => {
    const issues = collectPrecheckIssues({
      docsFiles: new Set(['README.md', 'README_zh_CN.md']),
      i18nEn: {
        addTopBarIcon: 'Friendly Search Replace',
        togglePanel: 'Open find panel',
      },
      i18nZh: {
        addTopBarIcon: '搜 easy',
        togglePanel: '打开查找面板',
      },
      packageJson: {
        version: '1.2.3',
      },
      pluginJson: {
        minAppVersion: '3.5.7',
        readme: {
          default: 'README.md',
          zh_CN: 'README_zh_CN.md',
        },
        version: '1.2.3',
      },
    })

    expect(issues).toEqual([])
  })

  it('reports version mismatch and missing minAppVersion', () => {
    const issues = collectPrecheckIssues({
      docsFiles: new Set(['README.md']),
      i18nEn: {},
      i18nZh: {},
      packageJson: {
        version: '1.2.4',
      },
      pluginJson: {
        minAppVersion: '',
        readme: {
          default: 'README.md',
        },
        version: '1.2.3',
      },
    })

    expect(issues.map(issue => issue.code)).toContain('version_mismatch')
    expect(issues.map(issue => issue.code)).toContain('missing_min_app_version')
  })

  it('reports i18n key mismatch and missing readme files', () => {
    const issues = collectPrecheckIssues({
      docsFiles: new Set(['README.md']),
      i18nEn: {
        onlyEn: 'value',
        shared: 'value',
      },
      i18nZh: {
        onlyZh: '值',
        shared: '值',
      },
      packageJson: {
        version: '1.2.3',
      },
      pluginJson: {
        minAppVersion: '3.5.7',
        readme: {
          default: 'README.md',
          zh_CN: 'README_zh_CN.md',
        },
        version: '1.2.3',
      },
    })

    expect(issues.map(issue => issue.code)).toContain('i18n_key_mismatch')
    expect(issues.map(issue => issue.code)).toContain('missing_readme_file')
  })

  it('reports plugin metadata when the default locale does not use the English-facing values', () => {
    const issues = collectPrecheckIssues({
      docsFiles: new Set(['README.md', 'README_zh_CN.md']),
      i18nEn: {
        addTopBarIcon: 'Friendly Search Replace',
      },
      i18nZh: {
        addTopBarIcon: '搜 easy',
      },
      packageJson: {
        version: '1.2.3',
      },
      pluginJson: {
        description: {
          default: '中文描述',
          zh_CN: '中文描述',
        },
        displayName: {
          default: '搜 easy',
          zh_CN: '搜 easy',
        },
        minAppVersion: '3.5.7',
        readme: {
          default: 'README.md',
          zh_CN: 'README_zh_CN.md',
        },
        version: '1.2.3',
      },
    })

    expect(issues.map(issue => issue.code)).toContain('display_name_default_mismatch')
  })

  it('reports redundant en_US plugin metadata fields', () => {
    const issues = collectPrecheckIssues({
      docsFiles: new Set(['README.md', 'README_zh_CN.md']),
      i18nEn: {
        addTopBarIcon: 'Friendly Search Replace',
      },
      i18nZh: {
        addTopBarIcon: '搜 easy',
      },
      packageJson: {
        version: '1.2.3',
      },
      pluginJson: {
        description: {
          default: 'VS Code style find-and-replace for the current SiYuan document.',
          en_US: 'VS Code style find-and-replace for the current SiYuan document.',
          zh_CN: '中文描述',
        },
        displayName: {
          default: 'Friendly Search Replace',
          en_US: 'Friendly Search Replace',
          zh_CN: '搜 easy',
        },
        minAppVersion: '3.5.7',
        readme: {
          default: 'README.md',
          en_US: 'README.md',
          zh_CN: 'README_zh_CN.md',
        },
        version: '1.2.3',
      },
    })

    expect(issues.map(issue => issue.code)).toContain('redundant_en_us_metadata')
  })
})

describe('getReleaseStaticCopyTargets', () => {
  it('copies only locale json files into the packaged i18n directory', () => {
    const i18nTarget = getReleaseStaticCopyTargets()
      .find(target => target.dest === './i18n/')

    expect(i18nTarget).toEqual({
      dest: './i18n/',
      src: './src/i18n/*.json',
    })
  })
})
