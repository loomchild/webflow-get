const core = require('@actions/core')
const YAML = require('yaml')
const picomatch = require('picomatch')
const fetch = require('node-fetch')
const prettier = require('prettier')
const fs = require('fs').promises

const RETRY_COUNT = 3
const RETRY_DELAY = 10 * 1000

const CSS_PATTERN = '.*(?:(?:\\/.*\\.webflow)|(?:website-files.com.*))\\.[a-z0-9]+(?:\\.min)?\\.css'
const CSS_REGEX = new RegExp(`<link href="(${CSS_PATTERN})".*\\/>`)
const CSS_REPLACE_REGEX = new RegExp(`(?<=<link href=")(${CSS_PATTERN})(?=".*\\/>)`)

const ROOT_FOLDER = process.env.GITHUB_WORKSPACE
const REPOSITORY_NAME = process.env.GITHUB_REPOSITORY
const HOST_NAME =  `https://${process.env.GITHUB_REPOSITORY}`

const visitedPages = new Set()
const siteMapUrls = []
const alreadyCreatedPaths = new Set()

class RetryError extends Error {
    constructor() {
        super('Retrying resource')
        this.name = 'RetryError'
    }
}

class RetryAllError extends Error {
    constructor() {
        super('Retrying site')
        this.name = 'RetryAllError'
    }
}

function getInputBoolean(name) {
    const input = core.getInput(name)
    return input && !(['0', 'false', 'no', 'off'].includes(input))
}

async function initConfig() {
    const configFile = await readFile('webflowgit.yml')
    let config = YAML.parse(configFile)

    if (config.site.endsWith('/')) {
        config.site = config.site.slice(0, -1);
    }

    if (config.pages) {
        const ignorePage = picomatch(config.pages.ignore || [])
        config.pages = {
            valid: page => !ignorePage(page)
        }
    }

    config.force = getInputBoolean('force')

    return config
}

async function processSite(config) {
    const site = config.site

    console.log(`Processing site ${site}`)

    const lastTimestamp = await getLastTimestamp(config)

    let index = await fetchPage(site)
    const timestamp = getTimestampFromHTML(index)

    if (timestamp <= lastTimestamp) {
        console.log('No changes since last run, skipping')
        return
    }

    // const cssUrl = getCSSURL(index)
    // let css = await retry(() => fetchCSS(cssUrl, timestamp), RETRY_COUNT)
    // css = formatCSS(css)
    // await writePublicFile('style.css', css)

    if (config.pages) {
        console.log('Fetching pages')

        if (config.pages.valid('/index')) {
            index = formatHTML(index)
            await writePublicFile('index.html', index)
        }

        await getFoundPages(site, index, timestamp)
    }

    writeFile('.timestamp', timestamp)
}

async function getPage(site, pageUrl, timestamp) {
    try {
        let html = await retry(() => {
            console.log(`Fetching ${pageUrl}`)
            return fetchPage(`${site}/${pageUrl}`, timestamp)
        }, RETRY_COUNT)

        siteMapUrls.push(pageUrl)

        await getFoundPages(site, html, timestamp)
        html = formatHTML(html)
        await writePublicFile(`${pageUrl}.html`, html)
    } catch (error) {
        console.error(`${error.message}: ${pageUrl}`)
    }
}

async function getFoundPages(site, html, timestamp) {
    const foundPaths = collectPathsFromHtml(html)
    const newPaths = foundPaths.filter((path) => {
        if (visitedPages.has(path)) {
            return false
        }

        visitedPages.add(path)
        return true
    })    

    return await Promise.all(newPaths.map(path => getPage(site, path, timestamp)))
}

async function fetchPage(url, expectedTimestamp = null) {
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`)
    }

    const body = await response.text()

    const timestamp = getTimestampFromHTML(body)
    checkTimestamp(timestamp, expectedTimestamp)

    return body
}

function getCSSURL(index) {
    const cssMatch = index.match(CSS_REGEX)

    if (!cssMatch) {
        throw new Error('CSS file not found')
    }

    const cssURL = cssMatch[1]
    return cssURL
}

async function fetchCSS(url, expectedTimestamp = null) {
    const response = await fetch(url)

    if (!response.ok) {
        throw new Error(`${response.status}: ${response.statusText}`)
    }

    const css = await response.text()

    const timestamp = getTimestampFromCSS(css)
    checkTimestamp(timestamp, expectedTimestamp)

    return css
}

function collectPathsFromHtml(html) {
    return [...html.matchAll(/"\/+([^"\.\s]*)"|'\/+([^'\.\s]*)'/g)].map(match => match[1] || match[2]).filter(url => url)
}

async function fetchSitemap(site) {
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

function getPages(site) {
    let pages = [...sitemap.matchAll(/<loc>(.*)<\/loc>/g)]

    pages = pages.map(m => m[1])
        .map(url => url.substring(site.length).replace(/^\/|\/$/g, ''))
        .filter(page => page)

    return pages
}

async function getLastTimestamp(config) {
    if (config.force || !(await pathExists('.timestamp'))) {
        return '1970-01-01T00:00:00Z'
    }

    const timestamp = await readFile('.timestamp')
    return timestamp.trim()
}

function getTimestampFromCSS(css) {
    const timestampMatch = css.match(/\/* Generated on: ([^(]+) \(/)
    if (!timestampMatch) {
        console.warn('Missing CSS timestamp, ignoring timestamp check')
        return null
    }
    const timestamp = timestampMatch[1]
    return new Date(timestamp).toISOString()
}

function getTimestampFromHTML(html) {
    const timestampMatch = html.match(/<!-- Last Published: ([^(]+) \(/)
    if (!timestampMatch) {
        throw new Error('HTML timestamp not found')
    }
    const timestamp = timestampMatch[1]
    return new Date(timestamp).toISOString()
}

function formatCSS(css) {
    css = prettier.format(css, { parser: 'css' })

    // Cut the timestamp line
    css = css.substring(css.indexOf('\n') + 1)

    return css
}

function formatHTML(html) {
    html = prettier.format(html, { parser: 'html', printWidth: 200 })

    // // Cut the timestamp line
    // const start = html.indexOf('\n') + 1
    // const end = html.indexOf('\n', start) + 1
    // html = html.substring(0, start) + html.substring(end)

    // // Remove the style hash
    // html = html.replace(CSS_REPLACE_REGEX, './style.css')

    return html
}

function checkTimestamp(timestamp, expectedTimestamp) {
    /*  if (timestamp && expectedTimestamp) {
        if (timestamp < expectedTimestamp) {
          console.log('Retrying resource')
          throw new RetryError()
        } else if (timestamp > expectedTimestamp) {
          console.log('Retrying site')
          throw new RetryAllError()
        }
      }*/
}

async function retry(func, retryCount = 0, errorType = RetryError, delay = RETRY_DELAY) {
    try {
        return await func()
    } catch (error) {
        if (error instanceof errorType) {
            if (retryCount > 0) {
                await sleep(delay)
                return retry(func, retryCount - 1, errorType, delay)
            } else {
                throw new Error('Too many retries, aborting')
            }
        }

        throw error
    }
}

async function assurePathExists(path) {
    let parts = path.split('/').filter(part => part)
    parts = parts.slice(0, parts.length - 1)

    let current = ''

    for (const part of parts) {
        current += `/${part}`
        if (!alreadyCreatedPaths.has(current) && !(await pathExists(current))) {
            if (!alreadyCreatedPaths.has(current)) {
//                try {
                    await fs.mkdir(`${ROOT_FOLDER}${current}`)
                    alreadyCreatedPaths.add(current)
//                } catch (error) {
//                    
//                }
            }
        }
    }
}

async function pathExists(path) {
    if (path.startsWith('/')) {
        path = path.substring(1)
    }

    try {
        await fs.access(`${ROOT_FOLDER}/${path}`)
        return true
    } catch (error) {
        return false
    }
}

async function readFile(name) {
    return await fs.readFile(`${ROOT_FOLDER}/${name}`, 'utf8')
}

async function writeFile(name, content) {
    await fs.writeFile(`${ROOT_FOLDER}/${name}`, content)
}

async function writePublicFile(name, content) {
    await assurePathExists(`public/${name}`)
    await writeFile(`public/${name}`, content)
}

function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout))
}

async function main() {
    const config = await initConfig()

    if (!config.site) {
        console.log('Missing site, skipping')
        return
    }

    await retry(() => processSite(config), RETRY_COUNT, RetryAllError, RETRY_DELAY * 2)

    const siteMapStr = `
        <?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        ` + siteMapUrls.map((url) => `
            <url>
                <loc>${HOST_NAME}/${url}</loc>
                <lastmod>2018-06-04</lastmod>
            </url>
        `, siteMapUrls) + `
        </urlset>
        `
}

main()
    .then(() => {
        console.log('Executed successfully')
    })
    .catch((error) => {
        console.error(error)
        core.setFailed(error.message)
    })
