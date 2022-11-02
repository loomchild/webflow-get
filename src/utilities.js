import fs from "node:fs/promises";
import fetch from 'node-fetch';
import { pipe } from "./lib/continuation-passing";

export const config = JSON.parse(await fs.readFile("config.json"));

// async function getConfig() {
//   if (config) {
//     return config;
//   }

//   return await pipe([
//     () => ("config.json"),
//     fs.readFile,
//     JSON.parse,
//     function (value) {
//       config = value;
//     }
//   ])();
// } 

export function createPageFromUrlAndHtml(url, html) {
  return {
    url,
    html,
  };
}

/**
 * @param  {Array<string>} knownUrls
 * @param  {Function} htmlFromUrl
 * @param  {Function} urlsFromHtml
 * @param  {Function} callbackWithPage
 */
export async function crawlUrlsUsing(knownUrls, htmlFromUrl, urlsFromHtml, callbackWithPage) {
  const knownUrlsSet = new Set(knownUrls);

  for (const knownUrl of knownUrlsSet) {
    const html = await htmlFromUrl(knownUrl);

    if (html === undefined) {
      continue;
    }

    const page = { url: knownUrl, html };

    const foundUrls = urlsFromHtml(html);

    for (const foundUrl of foundUrls) {
      if (!knownUrlsSet.has(foundUrl)) {
        knownUrlsSet.add(foundUrl);
      }
    }

    callbackWithPage && await callbackWithPage(page);
  }

  return knownUrlsSet;
}



export function absoluteUrlsFromHtml(htmlCode) {
  return new Set([...htmlCode.matchAll(/href=['"](\/[^'"]*)['"]/g)].map((match => match[1])));
}



export function fullUrlsFromHtml(htmlCode) {
  return new Set([...htmlCode.matchAll(/href=['"](\/[^'"]*)['"]/g)].map((match => config["webflowSiteBaseUrl"] + match[1])));
}



export function webflowPublishedDateFrom(html) {
  const match = html.match(/<!-- Last Published: ([^-]+) \(Coordinated Universal Time\) -->/);

  if (match === null) {
    throw Error("Webflow timestamp not found");
  }

  return new Date(match[1]);
}



export function shouldCreateSnapshotUsing(getPublishedDateFromUrl, getLocalSnapshotDate) {
  return getPublishedDateFromUrl("/") > getLocalSnapshotDate();
}



export async function storePageHtml(outputFolderName, absolutePath, html) {
  const fileUri = [outputFolderName, absolutePath.replace(/\/+$/, '').replace(/^\/+/, ''), `index.html`].filter(segment => segment).join("/");

  await storeTextContentIntoFile(html, fileUri);

  return fileUri;
}



export async function storeTextContentIntoFile(textContent, fileUri) {
  const folders = fileUri.split("/").slice(0, -1);
  let folderToCheck = "";

  for (const folder of folders) {
    folderToCheck += `${folder}/`;

    try {
      await fs.access(folderToCheck);
    } catch (error) {
      await fs.mkdir(folderToCheck)
    }
  }

  await fs.writeFile(fileUri, textContent, { flag: 'w' });
}



export async function htmlFromFullUrl(absoluteUrl) {
  const response = await fetch(absoluteUrl);

  if (!response.ok) {
    console.error(`${response.status}: ${response.statusText} ${absoluteUrl}`);
  }

  return response.text();
}



export async function pageFromUrl(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  const html = response.text();

  return { url, html };
}



export async function existsFile(fileUri) {
  try {
    await fs.access(fileUri)
    return true;
  } catch (error) {
    return false;
  }
}


export async function readFileContent(fileUri) {
  if (!(await existsFile(fileUri))) {
    return undefined;
  }

  await fs.readFile(fileUri);
}


export async function getLocalSnapshotDate(fileUri) {
  if (!(await existsFile(fileUri))) {
    return '1970-01-01T00:00:00Z'
  }

  const timestamp = (await fs.readFile(fileUri)).toString();
  return timestamp.trim()
}



export async function getAndStoreHtmlFrom(absoluteUrl) {
  const hostname = "https://travlrd.com";
  const html = await htmlFromFullUrl(hostname + absoluteUrl);
  await storePageHtml(OUTPUT_FOLDER, absoluteUrl, html);
  return html;
}

export async function snapshotFullWebsite(outputFolderName, entryUrls) {
  await crawlUrlsUsing(entryUrls, htmlFromFullUrl, fullUrlsFromHtml, async function (page) {
    const fileUri = [outputFolderName, (new URL(page.url)).pathname.replace(/^\/+/, ''), `index.html`].filter(segment => segment).join("/");
    await storeTextContentIntoFile(page.html, fileUri);
    return fileUri;
  });
}


export async function updateSnapshot() {
  const entryUrls = config.entryPaths.map(path => config.webflowSiteBaseUrl + path);

  const urlsSet = await crawlUrlsUsing(entryUrls, htmlFromFullUrl, fullUrlsFromHtml, async function (page) {
    const fileUri = [config.outputFolderUri, (new URL(page.url)).pathname.replace(/^\/+/, ''), `index.html`].filter(segment => segment).join("/");
    await storeTextContentIntoFile(page.html, fileUri);
    return fileUri;
  });

  const urls = [...urlsSet.values()];

  const sitemapXml = sitemapXmlFromUrls(urls);
  await storeTextContentIntoFile(sitemapXml, "public/sitemap.xml");
  await storeTextContentIntoFile(robotsTxt, "public/robots.txt");
};


function sitemapXmlFromUrls(fullUrls) {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  return (`
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ` + fullUrls.map((fullUrl) => `
        <url>
            <loc>${fullUrl.replace(config.webflowSiteBaseUrl, config.productionSiteBaseUrl)}</loc>
            <lastmod>${dateStr}</lastmod>
        </url>
    `).join("") + `
    </urlset>
  `);
}

const robotsTxt = `
User-agent: Googlebot
Disallow: /nogooglebot/

User-agent: *
Allow: /
`;