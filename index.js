import { launch } from "puppeteer";
import fs from "fs";

const URL_DETAIL = process.env.URL_DETAIL;
const URL = process.env.URL;
const TABLE_HEADERS = process.env.TABLE_HEADERS;
const OUT_FILE = process.env.OUT_FILE;

const ELEMENT_SELECTOR_FIRST = process.env.ELEMENT_SELECTOR_FIRST;
const ELEMENT_SELECTOR_SECOND = process.env.ELEMENT_SELECTOR_SECOND;

const list = [];

const queryRecord = async (page, regNo) => {
  console.log("processing ", regNo);
  await page.$eval(ELEMENT_SELECTOR_FIRST, (input) => (input.value = ""));
  await page.type(ELEMENT_SELECTOR_FIRST, regNo + "");

  const [response] = await Promise.all([
    page.waitForResponse(
      URL_DETAIL
    ),
    page.click(ELEMENT_SELECTOR_SECOND),
  ]);

  try {
    await Promise.race([
      page.waitForSelector(".table", { timeout: 5000 }),
      page.waitForSelector(".alert", { timeout: 5000 }),
    ]);

    const isTablePresent = await page.$eval(".table", (el) => el !== null);
    if (isTablePresent) {
      const thData = await page.evaluate(() => {
        const table = document.querySelector(".table");

        return {
          [TABLE_HEADERS[0]]: table
            .querySelector("tr:nth-child(1)")
            .querySelector("th")
            .textContent.trim()
            .replace("Registration Number:", ""),
          [TABLE_HEADERS[1]]: table
            .querySelector("tr:nth-child(2)")
            .querySelector("th")
            .textContent.trim()
            .replace("Name:", ""),
          [TABLE_HEADERS[2]]: table
            .querySelector("tr:nth-child(3)")
            .querySelector("th")
            .textContent.trim()
            .replace("Firm Name:", ""),
          [TABLE_HEADERS[3]]: table
            .querySelector("tr:nth-child(4)")
            .querySelector("th")
            .textContent.trim()
            .replace("Address:", ""),
        };
      });
      console.log(thData);
      return thData;
    } else {
      const errorMessage = await page.$eval(".alert", (el) => el.textContent);
      console.log("Error message:", errorMessage);
    }
  } catch (error) {
    console.error("Timeout waiting for table or error message");
    return null;
  }
  return null;
};

const jsonToCSV = (json) => {
  var fields = Object.keys(json[0]);
  var replacer = function (key, value) {
    return value === null ? "" : value;
  };
  var csv = json.map(function (row) {
    return fields
      .map(function (fieldName) {
        return JSON.stringify(row[fieldName], replacer);
      })
      .join(",");
  });
  csv.unshift(fields.join(",")); // add header column
  csv = csv.join("\r\n");
  return csv;
};

async function main(total = 10, skip = 0) {
  console.time("main");
  const browser = await launch({
    headless: true,
  });
  const page = await browser.newPage();
  await page.goto(URL);

  const numbers = [...Array(total).keys()];
  for await (const num of numbers) {
    const res = await queryRecord(page, num + skip);
    res && list.push(res);
  }

  await browser.close();
  console.timeEnd("main");
}

await main(process.argv[2], process.argv[3]);
const csvData = jsonToCSV(list);

fs.writeFile(`${OUT_FILE}`, csvData, "utf8", (e) => {});
