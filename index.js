const bot = require('./src');
const fetch = require('node-fetch');
const NodeCache = require("node-cache");
const currentCurriences = new NodeCache();
let activeCurrencies = [];
let coinMarketCapPrice = [];
let positions = {};
let rsiLower = 20;
let rsiUpper = 70;
let priceOverAsk = 1.01;
let priceUnderBid = .99;
let portfolioStart = .124;
let stopLoss = .96;
let portfolio = .124; // 1000 USD
let amountToBuy = 0.0124; // 100 USD
let soldPositions = [];
const test = false;
let loopCount = 0;
const currenciesToCheck = 30;


module.exports = bot;

let myBot = new bot.Bot({ "apikey": "", "apisecret": "" });

function get150BiggestCurrencies() {
    let p = new Promise(function(resolve, reject) {
        fetch('https://api.coinmarketcap.com/v1/ticker/').then(function(response) {
            return response.json();
        }).then(function(json) {
            resolve(json);
        }).catch(function(e) {
            console.log(e);
        });
    });
    return p;
}

console.log("top 150");

function checkIfOwned(symbol) {
    return positions[symbol];
}

function canBuy(totalCost) {
    return portfolio - totalCost > 0;
}

function buy(symbol, rsiValue) {
    if (!checkIfOwned(symbol)) {
        console.log("BUY " + symbol);
        myBot.getMarketSummary(symbol).then(function(data) {
            console.log(data);
            let priceToBuy = data.result[0].Ask * priceOverAsk;
            let amountBought = amountToBuy / priceToBuy
            let totalCost = priceToBuy * amountBought;

            if (canBuy(totalCost)) {
                portfolio = portfolio - totalCost;
                let symbolData = data.result[0];
                symbolData["portfolio_at_buy_btc"] = portfolio;
                symbolData["buy_price_in_btc"] = priceToBuy;
                symbolData["rsi_value_at_buy"] = rsiValue;
                symbolData["total_amount_bought_in_btc"] = amountBought;
                symbolData["total_cost"] = totalCost;
                symbolData["buyTime"] = new Date().toDateString();
                symbolData["highest_price"] = data.result[0].Ask;
                symbolData["loopCount"] = 0;
                console.log(symbolData);
                positions[symbol] = symbolData;
            } else {
                console.log("not enough left in portfolio");
            }
        });
    }
}

function sell(symbol, rsiValue) {
    let p = new Promise(function(resolve, reject) {
        if (checkIfOwned(symbol)) {
            console.log("Possible Sell " + symbol);
            myBot.getMarketSummary(symbol).then(function(data) {
                let priceToSell = data.result[0].Bid * priceUnderBid;
                let totalCost = priceToSell * positions[symbol]["total_amount_bought_in_btc"];

                // sell rules    
                let symbolData = positions[symbol];
                if (
                    (symbolData["highest_price"] &&
                        // stop loss of 5 percent
                        priceToSell < symbolData["highest_price"] * stopLoss) ||
                    // held for a long time need to cycle
                    symbolData["loopCount"] > 1000
                ) {
                    console.log("***SOLD**" + symbol);
                    console.log(data);
                    portfolio = portfolio + totalCost;
                    symbolData["portfolio_at_sell_btc"] = portfolio;
                    symbolData["sell_price_in_btc"] = priceToSell;
                    symbolData["rsi_value_at_sell"] = rsiValue;
                    symbolData["total_cost_sold"] = totalCost;
                    symbolData["sellTime"] = new Date().toDateString();

                    delete positions[symbol];
                    console.log(symbolData);
                    soldPositions.push(symbolData);
                    resolve();
                } else {
                    resolve();
                }
            });
        } else {
            resolve();
        }
    });
    return p;
}

let countRsi = 0;

function callRsi(resolve) {
    if (activeCurrencies[countRsi]) {
        myBot.calculateRSI(activeCurrencies[countRsi].MarketCurrency).then(function(rsiValue) {
            console.log(activeCurrencies[countRsi].MarketCurrency + " - " + rsiValue);
            sell(activeCurrencies[countRsi].MarketCurrency, rsiValue).then(function() {
                if (rsiValue < rsiLower) {
                    buy(activeCurrencies[countRsi].MarketCurrency, rsiValue);
                }
                countRsi++;
                setTimeout(function() {
                    callRsi(resolve);
                }, 3000);
            });

        });
    } else {
        countRsi = 0;
        console.log("loop done");
        resolve();
    }
}

function makedecicions(resolve) {
    callRsi(resolve);
}

function start() {
    activeCurrencies = [];
    coinMarketCapPrice = [];
    let p = new Promise(function(resolve, reject) {
        get150BiggestCurrencies().then(function(coinmarketcapdata) {
            //coinmarketcapdata.sort((a, b) => (a.percent_change_24h > b.percent_change_24h) ? 1 : -1)
            let coinmarketCount = 0;
            myBot.getMarketSummaries().then(function(data) {
                if (data != null) {
                    for (let x in data.result) {
                        if (data.result[x].MarketName.indexOf("BTC-") != -1) {
                            for (let y in coinmarketcapdata) {
                                coinmarketCount++;
                                if (coinmarketcapdata[y].rank < currenciesToCheck) {
                                    let bitrexSymbol = data.result[x].MarketName.split("-");
                                    if (coinmarketcapdata[y].symbol == bitrexSymbol[1]) {
                                        let obj = data.result[x];
                                        obj.MarketCurrency = bitrexSymbol[1];
                                        activeCurrencies.push(obj);
                                        coinMarketCapPrice.push(coinmarketcapdata[y]);
                                    }
                                }

                            }
                        }
                    }
                }
                makedecicions(resolve);
            });
        });
    });
    return p;
}



function getCurrentPositionValue() {
    let positionsCost = 0;

    let symbolCost = {};
    activeCurrencies.forEach(function(data) {
        symbolCost[data.MarketCurrency] = data.Last;
    });

    for (let pos in positions) {
        positions[pos]["currentPrice"] = symbolCost[pos];
        let positionBTCCost = positions[pos]["currentPrice"] * positions[pos]["total_amount_bought_in_btc"];

        if (positions[pos]["highest_price"] && positions[pos]["highest_price"] < symbolCost[pos]) {
            positions[pos]["highest_price"] = symbolCost[pos];
        }

        positions[pos]["current_position_cost"] = positionBTCCost;
        positions[pos]["loopCount"]++;
        positionsCost += positionBTCCost;
    }
    console.log("Positions Cost: " + positionsCost);
    let unrealizedPort = positionsCost + portfolio;
    console.log("Unrelaized Portfolio " + unrealizedPort);
}

function loop() {
    loopCount++;
    console.log("loopCount " + loopCount);
    start().then(function(e) {
        console.log("*******************");
        console.log(positions);
        console.log("*******************");
        console.log("******* SOLD POSITIONS *******");
        console.log(soldPositions);
        console.log("**************************");
        console.log("start again");
        console.log("portfolio " + portfolio);
        console.log("portfolio Start " + portfolioStart);
        getCurrentPositionValue();
        loop();
    });
};

loop();