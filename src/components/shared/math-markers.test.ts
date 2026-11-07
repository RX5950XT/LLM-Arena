import { describe, expect, it } from 'vitest'
import { markMath } from './math-markers'

function marker(tex: string, display = false): string {
  return `<span data-tex="${encodeURIComponent(tex)}"${display ? ' data-tex-display="true"' : ''}></span>`
}

describe('程式碼裡的 $ 不動', () => {
  it.each([
    ['程式碼區塊', '```bash\necho $HOME and $PATH$\n```'],
    ['波浪號區塊', '~~~\n$a$ $b$\n~~~'],
    ['行內程式碼', '變數 `$a$` 和 `$b$` 都要設定'],
    ['清單裡的區塊', '1. 步驟\n\n   ```bash\n   echo $A$ $B$\n   ```'],
    ['引用裡的區塊', '> ```\n> $a$\n> ```'],
    ['縮排區塊', '說明\n\n    echo $A$'],
    ['串流中尚未結束的區塊', '```bash\necho $A$']
  ])('%s', (_, text) => {
    expect(markMath(text)).toBe(text)
  })

  it('程式碼前後的公式仍會處理', () => {
    expect(markMath('$x$ `$y$` $z$')).toBe(`${marker('x')} \`$y$\` ${marker('z')}`)
  })
})

describe('金額不是公式', () => {
  it.each([
    '方案 A 要 $5，方案 B 要 $10，差不多。',
    '方案 A 要 $5，方案 B 要$10',
    '價格 $5 到 $10',
    '區間 $5-$10',
    'It costs $x and then $y.',
    '花 $5 買 x，$',
    '跳脫的 \\$5 和 \\$10'
  ])('%s', (text) => {
    expect(markMath(text)).toBe(text)
  })

  it('金額和公式同一行時只標公式', () => {
    expect(markMath('花了 $5 算出 $x^2$')).toBe(`花了 $5 算出 ${marker('x^2')}`)
  })

  it('金額不會讓相鄰的行被併成一行', () => {
    const text = '- $5\n- $10\n\n下一段'
    expect(markMath(text)).toBe(text)
  })
})

describe('真正的公式', () => {
  it.each([
    ['行內', '公式 $E=mc^2$ 成立', `公式 ${marker('E=mc^2')} 成立`],
    ['數字開頭', '$2x+1$', marker('2x+1')],
    ['兩邊有空白', '$ x + y $', marker('x + y')],
    ['含中文', '$速度 = 距離/時間$', marker('速度 = 距離/時間')],
    ['跳脫的金額符號', '$\\$5 + x$', marker('\\$5 + x')],
    ['括號寫法', '\\(x\\) 和 \\( 5 + y \\)', `${marker('x')} 和 ${marker('5 + y')}`]
  ])('%s', (_, text, expected) => {
    expect(markMath(text)).toBe(expected)
  })

  it('置中公式', () => {
    expect(markMath('$$\na+b\n$$')).toBe(marker('a+b', true))
    expect(markMath('\\[a\n+b\\]')).toBe(marker('a\n+b', true))
  })

  it('跨行的行內公式會接回來', () => {
    expect(markMath('設 $x +\ny$ 為總和')).toBe(`設 ${marker('x + y')} 為總和`)
  })

  it('修正模型常見的寫法', () => {
    expect(markMath('$\\text{a$b}$')).toBe(marker('\\text{ab}'))
    expect(markMath('${\\rm km}$')).toBe(marker('\\mathrm{km}'))
  })
})
