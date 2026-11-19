/**
 * 收集容器内对搜索可见的文本节点。
 *
 * 过滤规则与各处搜索文本采集保持一致：跳过空白节点，
 * 以及位于属性面板标记、隐藏元素、svg/style/script 内的文本。
 */
export function collectVisibleTextNodes(root: ParentNode): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!(node instanceof Text) || !node.nodeValue?.trim()) {
        return NodeFilter.FILTER_REJECT
      }

      const parentElement = node.parentElement
      if (!parentElement || parentElement.closest('.protyle-attr, .fn__none, svg, style, script')) {
        return NodeFilter.FILTER_REJECT
      }

      return NodeFilter.FILTER_ACCEPT
    },
  })

  const textNodes: Text[] = []
  let currentNode = walker.nextNode()
  while (currentNode) {
    textNodes.push(currentNode as Text)
    currentNode = walker.nextNode()
  }

  return textNodes
}
