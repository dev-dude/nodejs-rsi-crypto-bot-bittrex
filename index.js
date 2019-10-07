const bot = require('./src');
const fetch = require('node-fetch');
const NodeCache = require("node-cache");
const currentCurriences = new NodeCache();
let activeCurrencies = [];
let positions = {};
let rsiLower = 35;
let rsiUpper = 70;
let priceOverAsk = 1.03;
let priceUnderBid = .97;
let portfolioStart = .124;
let portfolio = .124; // 1000 USD
let amountToBuy = 0.0124; // 100 USD
let soldPositions = [];
const test = false;
let loopCount = 0;
const currenciesToCheck = 40;


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

function buy(symbol) {
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
                symbolData["total_amount_bought_in_btc"] = amountBought;
                symbolData["total_cost"] = totalCost;
                console.log(symbolData);
                positions[symbol] = symbolData;
            } else {
                console.log("not enough left in portfolio");
            }
        });
    }
}

function sell(symbol) {
    if (checkIfOwned(symbol)) {
        console.log("SELL " + symbol);
        myBot.getMarketSummary(symbol).then(function(data) {
            console.log(data);
            let priceToSell = data.result[0].Bid * priceUnderBid;
            let totalCost = priceToSell * positions[symbol]["total_amount_bought_in_btc"];
            portfolio = portfolio + totalCost;
            let symbolData = positions[symbol];
            symbolData["portfolio_at_sell_btc"] = portfolio;
            symbolData["sell_price_in_btc"] = priceToSell;
            symbolData["total_cost_sold"] = totalCost;
            delete positions[symbol];
            console.log(symbolData);
            soldPositions.push(symbolData);
        });
    }
}

let countRsi = 0;

function callRsi(resolve) {
    if (activeCurrencies[countRsi]) {
        myBot.calculateRSI(activeCurrencies[countRsi].MarketCurrency).then(function(data) {
            console.log(activeCurrencies[countRsi].MarketCurrency + " - " + data);
            if ((test && loopCount > 5) || data > rsiUpper) {
                sell(activeCurrencies[countRsi].MarketCurrency);
            } else if (data < rsiLower) {
                buy(activeCurrencies[countRsi].MarketCurrency);
            }

            countRsi++;
            setTimeout(function() {
                callRsi(resolve);
            }, 5000);
        });
    } else {
        console.log("loop done");
        resolve();
    }
}

function makedecicions(resolve) {
    callRsi(resolve);
}

function start() {
    let p = new Promise(function(resolve, reject) {
        get150BiggestCurrencies().then(function(coinmarketcapdata) {
            myBot.getMarkets().then(function(data) {
                if (data != null) {
                    for (let x in data.result) {
                        if (data.result[x].MarketName.indexOf("BTC-") != -1) {
                            for (let y in coinmarketcapdata) {
                                if (parseInt(coinmarketcapdata[y].rank) < currenciesToCheck) {
                                    let bitrexSymbol = data.result[x].MarketName.split("-");
                                    if (coinmarketcapdata[y].symbol == bitrexSymbol[1]) {
                                        //console.log(data.result[x]);
                                        activeCurrencies.push(data.result[x]);
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
    for (let pos in positions) {
        positionsCost += positions[pos]["total_amount_bought_in_btc"] * positions[pos]["Last"];
    }
    console.log("Positions Cost: " + positionsCost);
    let unrealizedPort = positionsCost + portfolio;
    console.log("Unrelaized Portfolio " + unrealizedPort);
}

function loop() {
    loopCount++;
    console.log("loopCount " + loopCount);
    start().then(function(e) {
        console.log("start again");
        console.log("portfolio " + portfolio);
        console.log("portfolio Start " + portfolioStart);
        getCurrentPositionValue();
        console.log("*******************");
        console.log(positions);
        console.log("*******************");
        loop();
    });
};

loop();