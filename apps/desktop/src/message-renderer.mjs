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

export function renderMessageMarkdown(markdown = "") {
  const lines = String(markdown).replace(/\r\n/g, "\n").split("\n")
  const blocks = []
  const paragraphBuffer = []
  const listItems = []
  const orderedListItems = []
  let inCodeBlock = false
  let codeLines = []

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith("```")) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listItems, blocks)
      flushOrderedList(orderedListItems, blocks)

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

    if (!trimmed) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listItems, blocks)
      flushOrderedList(orderedListItems, blocks)
      continue
    }

    if (/^[-*_]{3,}$/.test(trimmed)) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listItems, blocks)
      flushOrderedList(orderedListItems, blocks)
      blocks.push("<hr>")
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (headingMatch) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listItems, blocks)
      flushOrderedList(orderedListItems, blocks)
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${renderInlineMarkdown(headingMatch[2])}</h${level}>`)
      continue
    }

    const listMatch = trimmed.match(/^[-*]\s+(.*)$/)
    if (listMatch) {
      flushParagraph(paragraphBuffer, blocks)
      flushOrderedList(orderedListItems, blocks)
      listItems.push(listMatch[1])
      continue
    }

    const orderedListMatch = trimmed.match(/^\d+[.)]\s+(.*)$/)
    if (orderedListMatch) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listItems, blocks)
      orderedListItems.push(orderedListMatch[1])
      continue
    }

    const quoteMatch = trimmed.match(/^>\s?(.*)$/)
    if (quoteMatch) {
      flushParagraph(paragraphBuffer, blocks)
      flushList(listItems, blocks)
      flushOrderedList(orderedListItems, blocks)
      blocks.push(`<blockquote>${renderInlineMarkdown(quoteMatch[1])}</blockquote>`)
      continue
    }

    flushList(listItems, blocks)
    flushOrderedList(orderedListItems, blocks)
    paragraphBuffer.push(trimmed)
  }

  if (inCodeBlock) {
    blocks.push(`<pre><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`)
  }

  flushParagraph(paragraphBuffer, blocks)
  flushList(listItems, blocks)
  flushOrderedList(orderedListItems, blocks)

  return blocks.join("")
}
