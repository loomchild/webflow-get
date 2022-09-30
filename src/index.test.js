const {
  crawlForUrls,
  absoluteUrlsFromHtml,
} = require('./index');



test.each([
  // 1 Given
  {
    given: { htmlCode: `href="/about-us"` },
    expected: { Urls: new Set(["/about-us"]) },
  },
  {
    given: { htmlCode: `href='/about-us'` },
    expected: { Urls: new Set(["/about-us"]) },
  },
  {
    given: { htmlCode: `href="/"` },
    expected: { Urls: new Set(["/"]) },
  },
  {
    given: { htmlCode: `href=""` },
    expected: { Urls: new Set([]) },
  },
  {
    given: { htmlCode: `href="post-title"` },
    expected: { Urls: new Set([]) },
  },
  {
    given: { htmlCode: `href="https://google.com"` },
    expected: { Urls: new Set([]) },
  },
  {
    given: { htmlCode: `href="/about-us" href="/blog/post"` },
    expected: { Urls: new Set(["/about-us", "/blog/post"]) },
  },
  {
    given: { htmlCode: `href="/about-us" href="/about-us"` },
    expected: { Urls: new Set(["/about-us"]) },
  },
])(`absoluteUrlsFromHtml`, function ({ given, expected }) {

  // 2 When
  const foundUrls = absoluteUrlsFromHtml(given.htmlCode);

  // 3 Then
  expect(foundUrls).toEqual(expected.Urls);
});



function htmlFromAbsoluteUrlFactory(mockWebsite) {
  return function (Url) {
    return mockWebsite.get(Url);
  };
}

test.each([
  // 1 Given
  {
    given: {
      knownAbsoluteUrls: ["/"],
      htmlFromAbsoluteUrl: htmlFromAbsoluteUrlFactory(new Map([["/", ``]])),
    },
    expected: {
      urls: new Set(["/"]),
    },
  },
  {
    given: {
      knownAbsoluteUrls: ["/"],
      htmlFromAbsoluteUrl: htmlFromAbsoluteUrlFactory(new Map([["/", `href="/contact"`], ["/contact", `href="/"`]])),
    },
    expected: {
      urls: new Set(["/", "/contact"]),
    },
  },
  {
    given: {
      knownAbsoluteUrls: ["/"],
      htmlFromAbsoluteUrl: htmlFromAbsoluteUrlFactory(new Map([["/", `href="/about-us"`], ["/about-us", `href="/contact"`], ["/contact", `href="/"`]])),
    },
    expected: {
      urls: new Set(["/", "/about-us", "/contact"]),
    },
  },
  {
    given: {
      knownAbsoluteUrls: ["/", "/page-1"],
      htmlFromAbsoluteUrl: htmlFromAbsoluteUrlFactory(new Map([["/", `href="/about-us"`], ["/about-us", `href="/contact"`], ["/contact", `href="/"`], ["/page-1", `href="/page-2"`], ["/page-2", `href="/page-1"`]])),
    },
    expected: {
      urls: new Set(["/", "/about-us", "/contact", "/page-1", "/page-2"]),
    },
  },
  {
    given: {
      knownAbsoluteUrls: ["/", "/page-1"],
      htmlFromAbsoluteUrl: htmlFromAbsoluteUrlFactory(new Map()),
    },
    expected: {
      urls: new Set(["/", "/page-1"]),
    },
  },
  {
    // Reproduced bug: when tried to fetch a non-existing page, then throwed an error
    given: {
      knownAbsoluteUrls: ["/"],
      htmlFromAbsoluteUrl: htmlFromAbsoluteUrlFactory(new Map([["/", `href="/contact"`]])),
    },
    expected: {
      urls: new Set(["/", "/contact"]),
    },
  },
])(`crawlForUrls`, function ({ given, expected }) {

  // 2 When
  const foundUrls = crawlForUrls(given.knownAbsoluteUrls, given.htmlFromAbsoluteUrl, absoluteUrlsFromHtml);

  // 3 Then
  expect(foundUrls).toEqual(expected.urls);
});



test.each([
  // 1 Given
  {
    given: {},
    expected: {},
  },
])(`sitemap`, function ({ given, expected }) {

  // 2 When

  // 3 Then
    expect(false).toBe(true);
});
