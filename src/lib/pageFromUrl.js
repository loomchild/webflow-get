import fetch from 'node-fetch';

// TODO: jkbfkjnkjsdfkl df skdf 

export async function pageFromUrl(url) {
  try {
    const response = await fetch(url, {});
    const html = await response.text();
    return { url, html };
  } catch (error) {
    return { url };
  }
}
