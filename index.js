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
let cacheCurrency = new Map();

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
  const fromFormatter = formatter(from);
  const result = fromFormatter.format(amount);
  if (cacheCurrency.get(from + "-" + to) !== undefined) {
    if (
      new Date().getTime() - 30000 <
      cacheCurrency.get(from + "-" + to).updatedDate.getTime()
    ) {
      console.log("Data is old to view, it will be fetched.");
      let millis = new Date().getTime();
      axios
        .get(
          "https://www.xe.com/currencyconverter/convert/?Amount=" +
            1 +
            "&From=" +
            from +
            "&To=" +
            to
        )
        .then((response) => {
          console.log("Response time: " + (new Date().getTime() - millis));
          const html = response.data;
          const $ = cheerio.load(html);
          let currency;
          $(".result__BigRate-sc-1bsijpp-1", html).each(function () {
            const money = $(this).text().split(" ")[0];
            currency = { money: money, updatedDate: new Date() };
            cacheCurrency.set(from + "-" + to, currency);
          });
          console.log(
            "Response will be returned in : " + (new Date().getTime() - millis)
          );
          return res.json(
            generateArticle(from, to, amount * currency.money, result)
          );
        })
        .catch((e) => {
          console.log("error: " + e);
          return { error: true, cause: e };
        });
    } else {
      console.log("Data is coming from cache.");
      return res.json(
        generateArticle(
          from,
          to,
          amount * cacheCurrency.get(from + "-" + to),
          result
        )
      );
    }
  } else {
    console.log("Fetched this rates for first time.");
    let millis = new Date().getTime();
    axios
      .get(
        "https://www.xe.com/currencyconverter/convert/?Amount=" +
          1 +
          "&From=" +
          from +
          "&To=" +
          to
      )
      .then((response) => {
        console.log("Response time: " + (new Date().getTime() - millis));
        const html = response.data;
        const $ = cheerio.load(html);
        let currency;
        $(".result__BigRate-sc-1bsijpp-1", html).each(function () {
          const money = $(this).text().split(" ")[0];
          currency = { money: money, updatedDate: new Date() };
          cacheCurrency.set(from + "-" + to, currency);
        });
        console.log(
          "Response will be returned in : " + (new Date().getTime() - millis)
        );
        return res.json(
          generateArticle(from, to, amount * currency.money, result)
        );
      })
      .catch((e) => {
        console.log("error: " + e);
        return { error: true, cause: e };
      });
  }
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

const getCurrency = (from, to, amount) => {
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
      let money;
      $(".result__BigRate-sc-1bsijpp-1", html).each(function () {
        money = $(this).text().split(" ")[0];
      });
      console.log(
        "Response will be returned in : " + (new Date().getTime() - millis)
      );
      const currency = { money: money, updatedDate: new Date() };
      cacheCurrency.set(from + "-" + to, currency);
      return JSON.stringify(currency);
    })
    .catch((e) => {
      console.log("error: " + e);
      return { error: true, cause: e };
    });
};

const generateArticle = (from, to, money, result) => {
  return {
    baseCurrency: {
      code: from,
      name: currencies.get(from),
      amount: !result.includes(".") ? result + ".00" : result,
    },
    rateCurrency: {
      code: to,
      name: currencies.get(to),
      amount: JSON.stringify(money),
    },
    updatedDate: new Date(),
  };
};
