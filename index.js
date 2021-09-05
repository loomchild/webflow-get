const core = require('@actions/core')
const fetch = require('node-fetch')
const prettier = require('prettier')
const fs = require('fs').promises

let site = null

function init () {
  site = core.getInput('site')
}

async function fetchIndex () {
  const response = await fetch(site)
  const body = await response.text()
  return body
}

async function fetchCSS (index) {
  const cssMatch = index.match(/<link href="(.*\/.*\.webflow\.[a-z0-9]+.css)".*\/>/)
  if (!cssMatch) {
    throw new Error('CSS file not found')
  }

  const cssURL = cssMatch[1]

  const response = await fetch(cssURL)
  const css = await response.text()
  return css
}

function formatCSS (css) {
  css = prettier.format(css, { parser: 'css' })

  // Cut the timestamp line
  css = css.substring(css.indexOf('\n') + 1)

  return css
}

async function writeFile (name, content) {
  await fs.writeFile(`${process.env.GITHUB_WORKSPACE}/${name}`, content)
}

async function main () {
  init()
  const index = await fetchIndex()
  let css = await fetchCSS(index)
  css = formatCSS(css)
  await writeFile('style.css', css)
}

main()
  .then(() => {
    console.log('Executed successfully')
  })
  .catch((error) => {
    console.error(error)
  })
