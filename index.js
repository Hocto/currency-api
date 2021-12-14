const PORT = process.env.PORT || 8000;
const express = require("express");
const cheerio = require("cheerio");
const axios = require("axios");
const morgan = require("morgan");
const currencies = require("./common/currencies");
const cachedRates = require("./common/cachedRates");
const isNumber = require("./common/isNumber");
const numberWithCommas = require("./common/numberWithCommas");
const withTwoDecimals = require("./common/withTwoDecimals");
const formatter = require("./common/formatter");
const moesifMiddleware = require("./common/moesif");

const app = express();

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
      new Date().getTime() - 60000 >
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
            let money = $(this).text().split(" ")[0];
            money = money.replace(",","");
            currency = { money: money, updatedDate: new Date() };
            console.log("Currency: ", JSON.stringify(currency));
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
      const currency = cacheCurrency.get(from + "-" + to);
      console.log("Currency: ", JSON.stringify(currency));
      return res.json(
        generateArticle(from, to, amount * currency.money, result)
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
          let money = $(this).text().split(" ")[0];
          money = money.replace(",","");
          currency = { money: money, updatedDate: new Date() };
          console.log("Currency: ", JSON.stringify(currency));
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
  if( cacheCurrency.get("currencies") !== undefined ){
    console.log("cached");
    return res.json(cacheCurrency.get("currencies"))
  }
  else {
    console.log("not cached");
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
      cacheCurrency.set("currencies", currencyList);
      return res.json(currencyList);
    })
    .catch((e) => {
      console.log("Error: " + e);
      return { error: true, cause: e };
    });
  }
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
  const amount = numberWithCommas(withTwoDecimals(money));
  return {
    baseCurrency: {
      code: from,
      name: currencies.get(from),
      amount: !result.includes(".") ? result + ".00" : result,
    },
    rateCurrency: {
      code: to,
      name: currencies.get(to),
      amount: !amount.includes(".") ? amount + ".00" : amount
    },
    updatedDate: new Date(),
  };
};

const cacheInit = (from, to) => {
  console.log("from: " + from + " to: " + to);
  axios
    .get(
      "https://www.xe.com/currencyconverter/convert/?Amount=" +
        1 +
        "&From=" +
        cachedRates[from] +
        "&To=" +
        cachedRates[to]
    )
    .then((response) => {
      const html = response.data;
      const $ = cheerio.load(html);
      let currency;
      $(".result__BigRate-sc-1bsijpp-1", html).each(function () {
        const money = $(this).text().split(" ")[0];
        currency = { money: money, updatedDate: new Date() };
        cacheCurrency.set(cachedRates[from] + "-" + cachedRates[to], currency);
      });
    })
    .catch((e) => {
      console.log("error: " + e);
    });
};

const init = (from, to, reverse) => {
  cacheInit(from, to);
  if (reverse) {
    if (to == 0) {
      if (from == 0) {
        reverse = false;
      } else {
        from = from - 1;
      }
      if (reverse) {
        to = cachedRates.length - 1;
      }
    } else {
      to = to - 1;
    }
  } else {
    if (to == cachedRates.length - 1) {
      if (from == cachedRates.length - 1) {
        reverse = true;
      } else {
        from = from + 1;
      }
      if (!reverse) {
        to = 0;
      }
    } else {
      to = to + 1;
    }
  }
  /*cacheCurrency.forEach((v, k) => {
    console.log(
      "Key: " + JSON.stringify(k) + " - Value: " + JSON.stringify(v.money)
    );
  });*/
  setTimeout(function () {
    init(from, to, reverse);
  }, 3000);
};

var reverse = false;
init(0, 0, reverse);
