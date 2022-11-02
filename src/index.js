import fs from "fs/promises";
import { getProperty, pipe, if_, equals_ } from "./lib/continuation-passing";
import { crawlUrlsUsing, readFileContent as getFileUriContent, getLocalSnapshotDate, htmlFromFullUrl, storeTextContentIntoFile, webflowPublishedDateFrom, updateSnapshot } from "./utilities";


const getWebUrlContent = htmlFromFullUrl;
const extractWebflowPublishDate = webflowPublishedDateFrom;


const softUpdateSnapshot = async function () {
    if (await getWebflowPublishDate() <= await getLocalSnapshotDate(".timestamp")) {
        return;
    }

    await updateSnapshot();
}



const getWebflowPublishDate = pipe([
    () => ("config.json"),
    getFileUriContent,
    JSON.parse,
    getProperty("webflowSiteBaseUrl"),

    getWebUrlContent,

    extractWebflowPublishDate,
]);


