import fetch from 'node-fetch';

export async function pageFromUrl(url) {
  try {
    const response = await fetch(url, {});
    const html = await response.text();
    return { url, html };
  } catch (error) {
    return { url };
  }
}
