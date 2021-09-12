const core = require('@actions/core')
const YAML = require('yaml')
const fetch = require('node-fetch')
const prettier = require('prettier')
const fs = require('fs').promises

async function init () {
  const repositoryName = process.env.GITHUB_REPOSITORY.replace(/^[^/]*/, '')

  const config = {
    site: repositoryName.includes('.') ? `https://${repositoryName}` : '',
    pages: false
  }

  const configFile = await readFile('webflowgit.yml')
  console.log(JSON.stringify(YAML.parse(configFile), null, 2))
  Object.apply(config, YAML.parse(configFile))

  return config
}

async function processSite (config) {
  const site = config.site
  console.log(`Processing site ${site}`)

  let index = await fetchPage(site)

  let css = await fetchCSS(index)
  css = formatCSS(css)
  await writeFile('style.css', css)

  if (site.pages) {
    index = formatHTML(index)
    await writeFile('index.html', index)

    const sitemap = await fetchSitemap(site)
    if (!sitemap) {
      console.log('No sitemap.xml, skipping fetching pages')
      return
    }

    const pages = getPages(site, sitemap)
    for (const page of pages) {
      let html = await fetchPage(`${site}/${page}`)
      html = formatHTML(html)
      await assurePathExists(page)
      await writeFile(`${page}.html`, html)
    }
  }
}

async function fetchPage (url) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`)
  }

  const body = await response.text()
  return body
}

async function fetchCSS (index) {
  const cssMatch = index.match(/<link href="(.*\/.*\.webflow\.[a-z0-9]+(?:\.min)?\.css)".*\/>/)
  if (!cssMatch) {
    throw new Error('CSS file not found')
  }

  const cssURL = cssMatch[1]

  const response = await fetch(cssURL)

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`)
  }

  const css = await response.text()
  return css
}

async function fetchSitemap (site) {
  const response = await fetch(`${site}/sitemap.xml`)

  if (!response.ok) {
    if (response.status === 404) {
      return null
    }
    throw new Error(`${response.status}: ${response.statusText}`)
  }

  const sitemap = await response.text()
  return sitemap
}

function getPages (site, sitemap) {
  let pages = [...sitemap.matchAll(/<loc>(.*)<\/loc>/g)]

  pages = pages.map(m => m[1])
    .map(url => url.substring(site.length).replace(/^\/|\/$/g, ''))
    .filter(page => page)

  return pages
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

  // Remove the style hash
  html = html.replace(/(?<=<link href=")(.*\/.*\.webflow\.[a-z0-9]+(?:\.min)?\.css)(?=".*\/>)/, './style.css')

  return html
}

async function assurePathExists (path) {
  let parts = path.split('/').filter(part => part)
  parts = parts.slice(0, parts.length - 1)

  let current = ''

  for (const part of parts) {
    current += `/${part}`
    try {
      await fs.access(`${process.env.GITHUB_WORKSPACE}/${current}`)
    } catch {
      await fs.mkdir(`${process.env.GITHUB_WORKSPACE}/${current}`)
    }
  }
}

async function readFile (name) {
  return await fs.readFile(`${process.env.GITHUB_WORKSPACE}/${name}`, 'utf8')
}

async function writeFile (name, content) {
  await fs.writeFile(`${process.env.GITHUB_WORKSPACE}/${name}`, content)
}

async function main () {
  const config = await init()

  if (!config.site) {
    console.log('Missing site, skipping')
    return
  }

  await processSite(config)
}

main()
  .then(() => {
    console.log('Executed successfully')
  })
  .catch((error) => {
    console.error(error)
    core.setFailed(error.message)
  })
