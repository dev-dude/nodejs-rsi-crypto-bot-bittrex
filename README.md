# bittrex-bot

[![Build Status](https://travis-ci.org/geopan/bittrex-bot.svg?branch=master)](https://travis-ci.org/geopan/bittrex-bot)
[![Coverage Status](https://coveralls.io/repos/github/geopan/bittrex-bot/badge.svg?branch=master)](https://coveralls.io/github/geopan/bittrex-bot?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/01b5aa409a3742608936a7f2c037aed9)](https://www.codacy.com/app/geopan/bittrex-bot?utm_source=github.com&utm_medium=referral&utm_content=geopan/bittrex-bot&utm_campaign=Badge_Grade)

A bot class designed for trading on bittrex exchange.

## Installation

```shell
npm i bittrex-bot
```

## Bot class

```js
const { Bot } = require("bittrex-bot");

const bot = new Bot({
  apikey: process.env.API_KEY,
  apisecret: process.env.API_SECRET
});
```

### Overview

Each method return a `promise`.

* params: coin
* return: object

```js
(async () => {
  const balance = await bot.getBalance("btc");
  console.log(balance);
})();
```
# nodejs-rsi-crypto-bot-bittrex
