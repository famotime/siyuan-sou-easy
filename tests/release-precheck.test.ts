import { describe, expect, it } from 'vitest'
import { collectPrecheckIssues } from '../scripts/release-precheck.mjs'

describe('collectPrecheckIssues', () => {
  it('passes when release metadata is consistent', () => {
    const issues = collectPrecheckIssues({
      docsFiles: new Set(['README.md', 'README_zh_CN.md']),
      i18nEn: {
        addTopBarIcon: 'Friendly Search Replace',
        togglePanel: 'Open find panel',
      },
      i18nZh: {
        addTopBarIcon: '更友好的查找替换',
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
          en_US: 'README_en.md',
          zh_CN: 'README_zh_CN.md',
        },
        version: '1.2.3',
      },
    })

    expect(issues.map(issue => issue.code)).toContain('i18n_key_mismatch')
    expect(issues.map(issue => issue.code)).toContain('missing_readme_file')
  })
})
