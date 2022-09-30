
function crawlForUrls(knownUrls, htmlFromUrl, urlsFromHtml) {
  knownUrls = new Set(knownUrls);

  knownUrls.forEach(function (knownUrl) {
    const html = htmlFromUrl(knownUrl);

    if (html === undefined) {
      return;
    }

    const foundUrls = urlsFromHtml(html);

    foundUrls.forEach(function (foundUrl) {
      if (knownUrls.has(foundUrl)) {
        return;
      }

      knownUrls.add(foundUrl);
    })
  });

  return knownUrls;
}



function absoluteUrlsFromHtml(htmlCode) {
  return new Set([...htmlCode.matchAll(/href=['"](\/[^'"]*)['"]/g)].map((match => match[1])));
}



module.exports = {
  crawlForUrls,
  absoluteUrlsFromHtml,
};
