import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MarkdownRenderer } from './MarkdownRenderer'

function render(content: string, plain = false): string {
  return renderToStaticMarkup(createElement(MarkdownRenderer, { content, plain }))
}

describe('模型回應裡的危險內容會被擋掉', () => {
  it.each([
    ['script', '<script>alert(1)</script>', /<script/i],
    ['iframe', '<iframe src="https://evil.example" srcdoc="x"></iframe>', /<iframe/i],
    ['object', '<object data="https://evil.example"></object>', /<object/i],
    ['embed', '<embed src="https://evil.example">', /<embed/i],
    ['事件屬性', '<div onclick="alert(1)">x</div>', /onclick/i],
    ['圖片事件', '<img src=x onerror="alert(1)">', /onerror/i],
    ['外部圖片', '<img src="https://evil.example/a.png?key=1">', /evil\.example/],
    ['Markdown 圖片', '![a](https://evil.example/a.png)', /evil\.example/],
    ['picture 來源', '<picture><source srcset="https://evil.example/a.png"></picture>', /evil\.example/],
    ['style 標籤', '<style>body{display:none}</style>', /<style|display:none/],
    ['style 屬性', '<div style="position:fixed;inset:0">x</div>', /position:fixed/],
    ['class 屬性', '<div class="fixed inset-0">x</div>', /fixed inset-0/],
    ['javascript 連結', '[a](javascript:alert(1))', /javascript:/i],
    ['HTML 的 javascript 連結', '<a href="javascript:alert(1)">a</a>', /javascript:/i],
    ['form', '<form action="https://evil.example"><input name="a"></form>', /evil\.example/]
  ])('%s', (_, attack, forbidden) => {
    expect(render(attack)).not.toMatch(forbidden)
    expect(render(attack, true)).not.toMatch(forbidden)
  })

  it('公式裡的連結不會生效', () => {
    expect(render('$\\href{javascript:alert(1)}{x}$')).not.toMatch(/href="javascript:/i)
  })

  it('自己寫的公式標記夾帶 HTML 也不會變成元素', () => {
    const html = render(`<span data-tex="${encodeURIComponent('<img src=x onerror=alert(1)>')}"></span>`)
    expect(html).not.toMatch(/<img/i)
  })
})

describe('正常內容照常顯示', () => {
  it('公式由 KaTeX 畫出', () => {
    expect(render('$E=mc^2$')).toContain('class="katex"')
  })

  it('程式碼裡的 $ 原樣顯示', () => {
    const html = render('```bash\necho $HOME and $PATH\n```', true)
    expect(html).toContain('echo $HOME and $PATH')
    expect(html).not.toContain('data-tex')
  })

  it('金額原樣顯示', () => {
    const html = render('方案 A 要 $5，方案 B 要 $10')
    expect(html).toContain('方案 A 要 $5，方案 B 要 $10')
    expect(html).not.toContain('katex')
  })

  it('表格與連結保留', () => {
    const html = render('| a |\n|---|\n| 1 |\n\n[b](https://example.com)')
    expect(html).toContain('<table>')
    expect(html).toContain('href="https://example.com"')
  })
})
