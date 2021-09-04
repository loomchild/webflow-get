import * as core from '@actions/core'
import fetch from 'node-fetch'

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

  const cssURL = cssMatch.groups[0]

  const response = await fetch(cssURL)
  const css = await response.text()
  return css
}

async function main () {
  init()
  const index = await fetchIndex()
  const css = await fetchCSS(index)
  console.log(css)
}

main()
  .then(() => {
    console.log('Executed successfully')
  })
  .catch((error) => {
    console.error(error)
  })
