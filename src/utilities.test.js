import fs from "node:fs/promises";


import {
  crawlUrlsUsing,
  absoluteUrlsFromHtml,
  webflowPublishedDateFrom,
  shouldCreateSnapshotUsing,
  storePageHtml,
  htmlFromFullUrl,
  getSnapshotDate,
  snapshotFullWebsite,
  storeTextContentIntoFile,
} from './utilities';




function runTest({ testName, given, when, then, fail }) {
  test(testName, function () {
    if (then) {
      return then(when(...Object.values(given)));
    } else if (fail) {
      expect(() => when(...Object.values(given))).toThrow(fail);
    } else {
      throw Error("Unspecified test acceptence condition.");
    }
  });
}

function runFunctionTests(testName, conditions, extras) {
  describe(testName, function () {
    if (extras?.beforeAll) {
      beforeAll(extras.beforeAll);
    }

    for (const { given, when, then, fail } of conditions) {
      runTest({ testName, given, when, fail, then });
    }
  });
}




describe("absoluteUrlsFromHtml", function () {

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
});





function htmlFromFullUrlFactory(mockWebsite) {
  return function (Url) {
    return mockWebsite.get(Url);
  };
}

describe("crawlUrlsUsing", function () {

  test.each([
    // 1 Given
    {
      given: {
        knownAbsoluteUrls: ["/"],
        htmlFromFullUrl: htmlFromFullUrlFactory(new Map([["/", ``]])),
      },
      expected: {
        urls: new Set(["/"]),
      },
    },
    {
      given: {
        knownAbsoluteUrls: ["/"],
        htmlFromFullUrl: htmlFromFullUrlFactory(new Map([["/", `href="/contact"`], ["/contact", `href="/"`]])),
      },
      expected: {
        urls: new Set(["/", "/contact"]),
      },
    },
    {
      given: {
        knownAbsoluteUrls: ["/"],
        htmlFromFullUrl: htmlFromFullUrlFactory(new Map([["/", `href="/about-us"`], ["/about-us", `href="/contact"`], ["/contact", `href="/"`]])),
      },
      expected: {
        urls: new Set(["/", "/about-us", "/contact"]),
      },
    },
    {
      given: {
        knownAbsoluteUrls: ["/", "/page-1"],
        htmlFromFullUrl: htmlFromFullUrlFactory(new Map([["/", `href="/about-us"`], ["/about-us", `href="/contact"`], ["/contact", `href="/"`], ["/page-1", `href="/page-2"`], ["/page-2", `href="/page-1"`]])),
      },
      expected: {
        urls: new Set(["/", "/about-us", "/contact", "/page-1", "/page-2"]),
      },
    },
    {
      given: {
        knownAbsoluteUrls: ["/", "/page-1"],
        htmlFromFullUrl: htmlFromFullUrlFactory(new Map()),
      },
      expected: {
        urls: new Set(["/", "/page-1"]),
      },
    },
    {
      // Regression test: when tried to fetch a non-existing page, then throwed an error
      given: {
        knownAbsoluteUrls: ["/"],
        htmlFromFullUrl: htmlFromFullUrlFactory(new Map([["/", `href="/contact"`]])),
      },
      expected: {
        urls: new Set(["/", "/contact"]),
      },
    },
  ])(`crawlUrlsUsing`, async function ({ given, expected }) {

    // 2 When
    const foundUrls = await crawlUrlsUsing(given.knownAbsoluteUrls, given.htmlFromFullUrl, absoluteUrlsFromHtml);

    // 3 Then
    expect(foundUrls).toEqual(expected.urls);
  });
});





runFunctionTests(
  "fn webflowPublishedDateFrom",
  [
    {
      given: {
        html: `<!-- Last Published: Sat Oct 01 2022 16:14:14 GMT+0000 (Coordinated Universal Time) -->`,
      },
      when: webflowPublishedDateFrom,
      then(foundDateTime) {
        expect(foundDateTime).toEqual(new Date(`Sat Oct 01 2022 16:14:14 GMT+0000`));
      },
    },
    {
      given: {
        html: `<!-- Last Published: Sat Oct 02 2022 16:14:14 GMT+0000 (Coordinated Universal Time) --><!-- Last Published: Sat Oct 01 2022 16:14:14 GMT+0000 (Coordinated Universal Time) -->`,
      },
      when: webflowPublishedDateFrom,
      then(foundDateTime) {
        expect(foundDateTime).toEqual(new Date(`Sat Oct 02 2022 16:14:14 GMT+0000`));
      },
    },
    {
      given: {
        html: ``,
      },
      when: webflowPublishedDateFrom,
      fail: "Webflow timestamp not found",
    },
  ],
);





runFunctionTests(
  "fn webflowPublishedDateFrom",
  [
    {
      given: {
        html: `<!-- Last Published: Sat Oct 01 2022 16:14:14 GMT+0000 (Coordinated Universal Time) -->`,
      },
      when: webflowPublishedDateFrom,
      then(foundDateTime) {
        expect(foundDateTime).toEqual(new Date(`Sat Oct 01 2022 16:14:14 GMT+0000`));
      },
    },
    {
      given: {
        html: `<!-- Last Published: Sat Oct 02 2022 16:14:14 GMT+0000 (Coordinated Universal Time) --><!-- Last Published: Sat Oct 01 2022 16:14:14 GMT+0000 (Coordinated Universal Time) -->`,
      },
      when: webflowPublishedDateFrom,
      then(foundDateTime) {
        expect(foundDateTime).toEqual(new Date(`Sat Oct 02 2022 16:14:14 GMT+0000`));
      },
    },
    {
      given: {
        html: ``,
      },
      when: webflowPublishedDateFrom,
      fail: "Webflow timestamp not found",
    },
  ],
);





runFunctionTests(
  "fn htmlFromFullUrl",
  [
    {
      given: {
        url: `https://google.com`,
      },
      when: htmlFromFullUrl,
      async then(promise) {
        const fetchedHtml = await promise;
        await expect(fetchedHtml).toMatch(/google/);
      },
    },
    {
      given: {
        url: `https://1.1.1.1`,
      },
      when: htmlFromFullUrl,
      async then(promise) {
        const fetchedHtml = await promise;
        await expect(fetchedHtml).toMatch(/Cloudflare/);
      },
    },
    {
      given: {
        url: `https://jsnfjnwekjfgnesnfnoéwenfofmowekfnwkfenofen.com`,
      },
      when: htmlFromFullUrl,
      async then(promise) {
        await expect(promise).rejects.toThrow();
      },
    },
  ],
);





runFunctionTests(
  "fn getSnapshotDate",
  [
    {
      given: {
        fileUri: "test/.timestamp"
      },
      when: getSnapshotDate,
      async then(snapshotDateString) {
        await expect(new Date(await snapshotDateString) < new Date()).toBeTruthy();
      },
    },
    {
      given: {
        fileUri: "non-existing-folder/.timestamp"
      },
      when: getSnapshotDate,
      async then(snapshotDateString) {
        await expect(await snapshotDateString).toBe("1970-01-01T00:00:00Z");
      },
    },
  ],
);




runFunctionTests(
  "fn snapshotFullWebsite",
  [
    {
      given: {
        folderName: "test/snapshot/",
        entyUrls: ["https://travlrd.com"],
      },
      when: snapshotFullWebsite,
      async then(promise) {
        await promise;
        const storedHtml = (await fs.readFile("test/snapshot/index.html")).toString();
        expect(storedHtml).toMatch(/TRAVLRD/);
      },
    },
  ],
  {
    async beforeAll() {
      try {
        await fs.access(`test/snapshot`);
        return fs.rm(`test/snapshot`, { recursive: true });
      } catch (error) {
      }
    },
  },
);





describe("shouldCreateSnapshotUsing", function () {

  function getPublishedDateFromUrlFactory(publishedDateFromHtml, htmlFromFullUrl) {
    return function getPublishedDateFromUrl(url) {
      return publishedDateFromHtml(htmlFromFullUrl(url));
    }
  }

  function getSnapshotDate() {
    return new Date("Sat Oct 01 2022 16:14:14 GMT+0000");
  }

  test.each([
    // 1 Given
    {
      given: {
        config: {},
        getPublishedDateFromUrl: getPublishedDateFromUrlFactory(
          webflowPublishedDateFrom,
          htmlFromFullUrlFactory(new Map([["/", `<!-- Last Published: Sat Oct 01 2022 16:14:14 GMT+0000 (Coordinated Universal Time) -->`]])),
        ),
      },
      expected: {
        shouldUpdate: false,
      },
    },
    {
      given: {
        config: {},
        getPublishedDateFromUrl: getPublishedDateFromUrlFactory(
          webflowPublishedDateFrom,
          htmlFromFullUrlFactory(new Map([["/", `<!-- Last Published: Sat Oct 03 2022 16:14:14 GMT+0000 (Coordinated Universal Time) -->`]])),
        ),
      },
      expected: {
        shouldUpdate: true,
      },
    },
  ])(`shouldCreateSnapshotUsing`, function ({ given, expected }) {

    // 2 When
    const isUpdated = shouldCreateSnapshotUsing(given.getPublishedDateFromUrl, getSnapshotDate);

    // 3 Then
    expect(isUpdated).toBe(expected.shouldUpdate);
  });
});





describe("storePageHtml", function () {

  beforeAll(async function () {
    try {
      await fs.access(`public`);
      return fs.rm(`public`, { recursive: true });
    } catch (error) {
    }
  });

  test.each([
    // 1 Given
    {
      given: { html: `${new Date().toISOString()}`, absolutePath: `/` },
    },
    {
      given: { html: `${new Date().toISOString()}`, absolutePath: `/about` },
    },
  ])(`storePageHtml`, async function ({ given, expected }) {
    // 2 When

    const fileUri = await storePageHtml("public", given.absolutePath, given.html);
    const storedHtml = (await fs.readFile(fileUri)).toString();

    // 3 Then
    expect(storedHtml).toBe(given.html);
  });
})



describe("storeTextContentIntoFile", function () {

  beforeAll(async function () {
    try {
      await fs.access(`test/storeTextContentIntoFile`);
      return fs.rm(`test/storeTextContentIntoFile`, { recursive: true });
    } catch (error) {
    }
  });

  test.each([
    // 1 Given
    {
      given: { fileUri: "test/storeTextContentIntoFile/test.kjafd", textContent: `test.kjafd` },
    },
  ])(`storeTextContentIntoFile`, async function ({ given, expected }) {
    const { fileUri, textContent } = given;
    // 2 When

    await storeTextContentIntoFile(textContent, fileUri);

    const storedText = (await fs.readFile(fileUri)).toString();

    // 3 Then
    expect(storedText).toBe(textContent);
  });
})

