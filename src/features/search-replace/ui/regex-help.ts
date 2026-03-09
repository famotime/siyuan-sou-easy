export const REGEX_HELP_TITLE = '正则搜索帮助'
export const REGEX_HELP_NOTE = '当前已支持正则搜索；替换文本仍按字面量写入，暂不支持 $1、\\1 等捕获组回填。'
export const REGEX_HELP_EXAMPLES = [
  {
    pattern: '安装|部署',
    description: '匹配“安装”或“部署”',
  },
  {
    pattern: '安装\\s+插件',
    description: '匹配中间含空白的“安装 插件”',
  },
  {
    pattern: 'v\\d+\\.\\d+\\.\\d+',
    description: '匹配版本号，例如 v1.2.3',
  },
]
