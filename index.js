const fetch = require('node-fetch')
const prettier = require('prettier')
const fs = require('fs').promises

async function init () {
  let sites = await readFile('sites')
  sites = sites.split('\n').filter(site => site)
  return sites
}

async function processSite (site) {
  console.log(`Processing site ${site}`)

  const prefix = await getPrefix(site)

  let index = await fetchIndex(site)

  let css = await fetchCSS(index)
  css = formatCSS(css)
  await writeFile(prefix, 'style.css', css)

  index = formatHTML(index)
  await writeFile(prefix, 'index.html', index)
}

async function fetchIndex (site) {
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

function formatHTML (html) {
  html = prettier.format(html, { parser: 'html', printWidth: 200 })

  // Cut the timestamp line
  const start = html.indexOf('\n') + 1
  const end = html.indexOf('\n', start) + 1
  html = html.substring(0, start) + html.substring(end)

  return html
}

async function getPrefix (site) {
  const prefix = site.replace(/http(s?):/, '')
    .replace(/\//, '')

  try {
    await fs.access(`${process.env.GITHUB_WORKSPACE}/${prefix}`)
  } catch {
    await fs.mkdir(`${process.env.GITHUB_WORKSPACE}/${prefix}`)
  }

  return prefix
}

async function readFile (name) {
  return await fs.readFile(`${process.env.GITHUB_WORKSPACE}/${name}`, 'utf8')
}

async function writeFile (prefix, name, content) {
  await fs.writeFile(`${process.env.GITHUB_WORKSPACE}/${prefix}/${name}`, content)
}

async function main () {
  const sites = await init()

  if (sites.length === 0) {
    console.log('No sites to process, skipping')
    return
  }

  for (const site of sites) {
    await processSite(site)
  }
}

main()
  .then(() => {
    console.log('Executed successfully')
  })
  .catch((error) => {
    console.error(error)
  })
