const core = require('@actions/core')
const YAML = require('yaml')
const picomatch = require('picomatch')
const fetch = require('node-fetch')
const prettier = require('prettier')
const fs = require('fs').promises

const RETRY_COUNT = 3
const RETRY_DELAY = 10 * 1000

class IndexTimestampError extends Error {
  constructor (message) {
    super(message)

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IndexTimestampError)
    }

    this.name = 'IndexTimestampError'
  }
}

async function init () {
  const repositoryName = process.env.GITHUB_REPOSITORY.replace(/^[^/]*\//, '')

  const config = {
    site: repositoryName.includes('.') ? `https://${repositoryName}` : '',
    pages: true
  }

  const configFile = await readFile('webflowgit.yml')
  Object.assign(config, YAML.parse(configFile))

  if (config.pages) {
    const ignorePage = picomatch(config.pages.ignore || [])
    config.pages = {
      valid: page => !ignorePage(page)
    }
  }

  return config
}

async function processSite (config) {
  const site = config.site
  console.log(`Processing site ${site}`)

  const lastTimestamp = await getLastTimestamp()

  let index = await fetchPage(site)
  const timestamp = getTimestampFromHTML(index)

  if (timestamp <= lastTimestamp) {
    console.log('No changes since last run, skipping')
    return
  }
  writeFile('.timestamp', timestamp)

  const cssUrl = getCSSURL(index)
  let css = await assureTimestamp(() => fetchCSS(cssUrl), getTimestampFromCSS, timestamp, RETRY_COUNT)
  css = formatCSS(css)
  await writeFile('style.css', css)

  if (config.pages) {
    console.log('Fetching pages')

    if (config.pages.valid('/index')) {
      index = formatHTML(index)
      await writeFile('index.html', index)
    }

    const sitemap = await fetchSitemap(site)
    if (!sitemap) {
      console.log('No sitemap.xml, skipping fetching pages')
      return
    }

    const pages = getPages(site, sitemap)
      .filter(page => config.pages.valid(`/${page}`))

    await Promise.all(pages.map(page => processPage(site, page, timestamp)))
  }
}

async function processPage (site, page, timestamp) {
  try {
    let html = await assureTimestamp(() => fetchPage(`${site}/${page}`), getTimestampFromHTML, timestamp, RETRY_COUNT)
    html = formatHTML(html)
    await assurePathExists(page)
    await writeFile(`${page}.html`, html)
  } catch (error) {
    console.error(`Failed processing page: ${error.message}`, error)
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

function getCSSURL (index) {
  const cssMatch = index.match(/<link href="(.*\/.*\.webflow\.[a-z0-9]+(?:\.min)?\.css)".*\/>/)
  if (!cssMatch) {
    throw new Error('CSS file not found')
  }

  const cssURL = cssMatch[1]
  return cssURL
}

async function fetchCSS (url) {
  const response = await fetch(url)

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

async function getLastTimestamp () {
  if (!(await pathExists('.timestamp'))) {
    return '1970-01-01T00:00:00Z'
  }

  const timestamp = await readFile('.timestamp')
  return timestamp.trim()
}

function getTimestampFromCSS (css) {
  const timestampMatch = css.match(/\/* Generated on: ([^(]+) \(/)
  if (!timestampMatch) {
    throw new Error('CSS timestamp not found')
  }
  const timestamp = timestampMatch[1]
  return new Date(timestamp).toISOString()
}

function getTimestampFromHTML (html) {
  const timestampMatch = html.match(/<!-- Last Published: ([^(]+) \(/)
  if (!timestampMatch) {
    throw new Error('HTML timestamp not found')
  }
  const timestamp = timestampMatch[1]
  return new Date(timestamp).toISOString()
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

async function assureTimestamp (fetch, getTimestamp, expectedTimestamp, retries) {
  if (retries < 0) {
    throw new Error(`Could not fetch resource with expectedTimestamp timestamp: ${expectedTimestamp}`)
  }

  const result = await fetch()
  const timestamp = getTimestamp(result)
  if (timestamp === expectedTimestamp) {
    return result
  } else if (timestamp < expectedTimestamp) {
    await sleep(RETRY_DELAY)
    return assureTimestamp(fetch, getTimestamp, expectedTimestamp, retries - 1)
  } else {
    throw new IndexTimestampError('Index timestamp older than another resource, site fetch aborting')
  }
}

async function assurePathExists (path) {
  let parts = path.split('/').filter(part => part)
  parts = parts.slice(0, parts.length - 1)

  let current = ''

  for (const part of parts) {
    current += `/${part}`
    if (!(await pathExists(current))) {
      await fs.mkdir(`${process.env.GITHUB_WORKSPACE}/${current}`)
    }
  }
}

async function pathExists (path) {
  try {
    await fs.access(`${process.env.GITHUB_WORKSPACE}/${path}`)
    return true
  } catch {
    return false
  }
}

async function readFile (name) {
  return await fs.readFile(`${process.env.GITHUB_WORKSPACE}/${name}`, 'utf8')
}

async function writeFile (name, content) {
  await fs.writeFile(`${process.env.GITHUB_WORKSPACE}/${name}`, content)
}

function sleep (timeout) {
  return new Promise(resolve => setTimeout(resolve, timeout))
}

async function main () {
  const config = await init()

  if (!config.site) {
    console.log('Missing site, skipping')
    return
  }

  try {
    await processSite(config)
  } catch (error) {
    if (error instanceof IndexTimestampError) {
      console.log('Timeout mismatch, retrying site')
      await sleep(RETRY_DELAY * 2)
      await processSite(config)
    } else {
      throw error
    }
  }
}

main()
  .then(() => {
    console.log('Executed successfully')
  })
  .catch((error) => {
    console.error(error)
    core.setFailed(error.message)
  })
