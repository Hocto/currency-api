const PORT = process.env.PORT || 8000;
const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const morgan = require("morgan");
const currencies = require("./common/currencies");
const isNumber = require("./common/isNumber");
const formatter = require("./common/formatter");
const moesifMiddleware = require("./common/moesif");

const app = express();

let articles = {};

let currencyList = {};

app.use(morgan("tiny"));
app.use(moesifMiddleware);

app.listen(PORT, () => {
  console.log(`server running on PORT: ${PORT}`);
});

app.get("/currency/:from/:to/:amount", (req, res) => {
  const from = req.params.from;
  const to = req.params.to;
  const amount = req.params.amount;
  if (amount.includes(",")) {
    return res.json({ message: "Amount should not contain comma" });
  }
  if (!isNumber(amount)) {
    return res.json({ message: "Amount should be numeric" });
  }
  if (currencies.get(from) == undefined || currencies.get(to) == undefined) {
    return res.json({ message: "Invalid currency code" });
  }
  let millis = new Date().getTime();
  axios
    .get(
      "https://www.xe.com/currencyconverter/convert/?Amount=" +
        amount +
        "&From=" +
        from +
        "&To=" +
        to
    )
    .then((response) => {
      console.log("Response time: " + (new Date().getTime() - millis));
      const html = response.data;
      const $ = cheerio.load(html);
      $(".result__BigRate-sc-1bsijpp-1", html).each(function () {
        const money = $(this).text().split(" ")[0];
        const fromFormatter = formatter(from);
        result = fromFormatter.format(amount);
        articles = {
          baseCurrency: {
            code: from,
            name: currencies.get(from),
            amount: !result.includes(".") ? result + ".00" : result,
          },
          rateCurrency: {
            code: to,
            name: currencies.get(to),
            amount: money,
          },
          updatedDate: new Date(),
        };
      });
      console.log("Response will be returned in : " + (new Date().getTime() - millis));
      return res.json(articles);
    })
    .catch((e) => {
      console.log("error: " + e);
      return { error: true, cause: e };
    });
});

app.get("/currencies", (req, res) => {
  axios
    .get("https://www.xe.com/currency/")
    .then((response) => {
      const html = response.data;
      const $ = cheerio.load(html);
      $(".currency__ListLink-sc-1xymln9-6", html).each(function () {
        const baseCode = $(this).text().trim();
        const codes = baseCode.split("-");
        currencyList[codes[0].trim()] = codes[1].trim();
      });
      return res.json(currencyList);
    })
    .catch((e) => {
      console.log("Error: " + e);
      return { error: true, cause: e };
    });
});
