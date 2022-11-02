import { describe, expect, test } from '@jest/globals';
import { pageFromUrl } from "./pageFromUrl";

describe("pageFromUrl", () => {
  test.each([
    {
      given: {
        url: `https://google.com`,
      },
      then(page) {
        expect(page.html).toMatch(/google/);
      },
    },
    {
      given: {
        url: `https://jsnfjnwekjfgnesnfnoéwenfofmowekfnwkfenofen.faknflaf`,
      },
      then(page) {
        expect(page.html).toBe(undefined);
      },
    },
  ])(`pure test`, async ({ given, then }) => {
    const page = await pageFromUrl(given.url);
    return then(page);
  });
});
