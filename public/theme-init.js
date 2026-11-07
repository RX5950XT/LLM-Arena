// 在畫面出現前決定主題，避免淺色使用者每次重新整理都閃一下深色。
// 放在獨立檔案，CSP 才能完全禁止頁面內嵌的程式。
try {
  var saved = localStorage.getItem('llm-arena-theme')
  var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
  document.documentElement.classList.toggle('dark', dark)
} catch (e) {
  document.documentElement.classList.add('dark')
}
