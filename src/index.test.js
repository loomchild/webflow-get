import { jest, describe, expect, test } from '@jest/globals';
import fs from "node:fs/promises";
import { updateSnapshot } from './utilities';


jest.setTimeout(60_000);


describe("updateSnapshot", () => {
  beforeAll(async () => {
    try {
      await fs.access(`test/updateSnapshot`);
      await fs.rm(`test/updateSnapshot`, { recursive: true });
    } catch (error) {
    }
  });

  test.each([
    {
      async then() {
        const storedHtml = (await fs.readFile("test/updateSnapshot/index.html")).toString();
        expect(storedHtml).toBeTruthy();
      },
    },
  ])(`filesystem test`, async ({ then }) => {
    await updateSnapshot();
    await then();
  });
});

