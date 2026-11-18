function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function renderInlineMarkdown(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/\*\*/g, "")
    .replace(/(?<!\*)\*(?!\*)/g, "")
}

function flushParagraph(buffer, blocks) {
  if (buffer.length === 0) {
    return
  }

  blocks.push(`<p>${renderInlineMarkdown(buffer.join(" "))}</p>`)
  buffer.length = 0
}

function flushList(items, blocks) {
  if (items.length === 0) {
    return
  }

  blocks.push(`<ul>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`)
  items.length = 0
}

function flushOrderedList(items, blocks) {
  if (items.length === 0) {
    return
  }

  blocks.push(`<ol>${items.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ol>`)
  items.length = 0
}

function parseTableCellLines(line) {
  let cells = line.split("|").map(s => s.trim())
  if (line.startsWith("|")) {
    cells.shift()
  }
  if (line.endsWith("|") && cells.length > 0) {
    cells.pop()
  }
  return cells
}

function isDelimiterRow(cells) {
  if (cells.length === 0) return false
  return cells.every(cell => /^[ \-\t:]+$/.test(cell) && cell.includes("-"))
}

function flushTable(header, alignments, rows, blocks) {
  if (!header || rows.length === 0) {
    return
  }
  const alignAttrs = alignments.map(align => align ? ` align="${align}"` : "")
  
  let html = `<div class="table-container"><table>`
  html += "<thead><tr>"
  header.forEach((cell, idx) => {
    const align = alignAttrs[idx] || ""
    html += `<th${align}>${renderInlineMarkdown(cell)}</th>`
  })
  html += "</tr></thead>"
  
  html += "<tbody>"
  rows.forEach(row => {
    html += "<tr>"
    for (let i = 0; i < header.length; i++) {
      const cell = row[i] || ""
      const align = alignAttrs[i] || ""
      html += `<td${align}>${renderInlineMarkdown(cell)}</td>`
    }
    html += "</tr>"
  })
  html += "</tbody></table></div>"
  
  blocks.push(html)
}

export function renderMessageMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n")
  const blocks = []
  const paragraphBuffer = []
  const listItems = []
  const orderedListItems = []
  
  let inCodeBlock = false
  let codeLines = []
  
  let inTable = false
  let tableHeader = null
  let tableAlignments = []
  let tableRows = []
  let pendingTableHeaderRow = null

  const flushNonTable = () => {
    flushParagraph(paragraphBuffer, blocks)
    flushList(listItems, blocks)
    flushOrderedList(orderedListItems, blocks)
  }

  const flushAll = () => {
    flushNonTable()
    if (inTable && tableHeader) {
      flushTable(tableHeader, tableAlignments, tableRows, blocks)
      inTable = false
      tableHeader = null
      tableAlignments = []
      tableRows = []
    } else if (pendingTableHeaderRow) {
      paragraphBuffer.push(pendingTableHeaderRow.join(" | "))
      pendingTableHeaderRow = null
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // 1. 代码块处理
    if (trimmed.startsWith("```")) {
      flushAll()
      if (inCodeBlock) {
        blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
        codeLines = []
        inCodeBlock = false
      } else {
        inCodeBlock = true
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    // 2. 空行处理
    if (!trimmed) {
      flushAll()
      continue
    }

    // 3. 表格解析逻辑
    if (trimmed.includes("|")) {
      const cells = parseTableCellLines(trimmed)
      
      // 如果当前是分隔符行
      if (isDelimiterRow(cells)) {
        if (pendingTableHeaderRow) {
          flushNonTable()
          inTable = true
          tableHeader = pendingTableHeaderRow
          tableAlignments = cells.map(cell => {
            const hasLeft = cell.startsWith(":")
            const hasRight = cell.endsWith(":")
            if (hasLeft && hasRight) return "center"
            if (hasRight) return "right"
            if (hasLeft) return "left"
            return ""
          })
          pendingTableHeaderRow = null
          continue
        }
      }
      
      // 如果已经在表格体中
      if (inTable) {
        tableRows.push(cells)
        continue
      }
      
      // 否则，暂存为潜在的表头行
      flushAll()
      pendingTableHeaderRow = cells
      continue
    }

    // 4. 非表格行，首先冲刷全部表格和缓存
    flushAll()

    // 5. 水平分割线
    if (/^[-*_]{3,}$/.test(trimmed)) {
      blocks.push("<hr>")
      continue
    }

    // 6. 标题
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    // 7. 无序列表
    const listMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (listMatch) {
      listItems.push(listMatch[1])
      continue
    }

    // 8. 有序列表
    const orderedListMatch = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (orderedListMatch) {
      orderedListItems.push(orderedListMatch[1])
      continue
    }

    // 9. 引用
    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      blocks.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`)
      continue
    }

    // 10. 普通文本段落
    paragraphBuffer.push(trimmed)
  }

  // 循环结束，冲刷缓存
  if (inCodeBlock) {
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
  }
  flushAll()

  return blocks.join("")
}
