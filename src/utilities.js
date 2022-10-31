import fs from "node:fs/promises";
import fetch from 'node-fetch';

export function createPageFromUrlAndHtml(url, html) {
  return {
    url,
    html,
  };
}

const config = {
  HOST_NAME: "https://travlrd.com",
};

export async function crawlUrlsUsing(knownUrls, htmlFromUrl, urlsFromHtml, callbackWithPage) {
  knownUrls = new Set(knownUrls);

  for (const knownUrl of knownUrls) {
    const html = await htmlFromUrl(knownUrl);

    if (html === undefined) {
      continue;
    }

    const page = { url: knownUrl, html };

    const foundUrls = urlsFromHtml(html);

    for (const foundUrl of foundUrls) {
      if (!knownUrls.has(foundUrl)) {
        knownUrls.add(foundUrl);
      }
    }

    callbackWithPage && await callbackWithPage(page);
  }

  return knownUrls;
}



export function absoluteUrlsFromHtml(htmlCode) {
  return new Set([...htmlCode.matchAll(/href=['"](\/[^'"]*)['"]/g)].map((match => match[1])));
}



export function fullUrlsFromHtml(htmlCode) {
  return new Set([...htmlCode.matchAll(/href=['"](\/[^'"]*)['"]/g)].map((match => config.HOST_NAME + match[1])));
}



export function webflowPublishedDateFrom(html) {
  const match = html.match(/<!-- Last Published: ([^-]+) \(Coordinated Universal Time\) -->/);

  if (match === null) {
    throw Error("Webflow timestamp not found");
  }

  return new Date(match[1]);
}



export function shouldCreateSnapshotUsing(getPublishedDateFromUrl, getSnapshotDate) {
  return getPublishedDateFromUrl("/") > getSnapshotDate();
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
    throw new Error(`${response.status}: ${response.statusText}`);
  }

  return response.text();
}



const pageFromUrlTests = [
  {
    given: {
      url: `https://google.com`,
    },
    when: pageFromUrl,
    async then(promise) {
      const { html } = await promise;
      await expect(html).toMatch(/google/);
    },
  },
  {
    given: {
      url: `https://1.1.1.1`,
    },
    when: pageFromUrl,
    async then(promise) {
      const { html } = await promise;
      await expect(html).toMatch(/Cloudflare/);
    },
  },
  {
    given: {
      url: `https://jsnfjnwekjfgnesnfnoéwenfofmowekfnwkfenofen.faknflaf`,
    },
    when: pageFromUrl,
    async then(promise) {
      await expect(promise).rejects.toThrow();
    },
  },
];

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



export async function getSnapshotDate(fileUri) {
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
  crawlUrlsUsing(entryUrls, htmlFromFullUrl, fullUrlsFromHtml, async function (page) {
    const fileUri = [outputFolderName, (new URL(page.url)).pathname.replace(/^\/+/, ''), `index.html`].filter(segment => segment).join("/");
    await storeTextContentIntoFile(page.html, fileUri);
    return fileUri;
  });
}


