<template>
    <div class="order-book">
        <h1>OrderBook</h1>
        <table>
            <thead>
                <tr>
                    <th>Price (USD)</th>
                    <th>Size</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                <!-- Render sell quotes -->
                <tr v-for="(quote, index) in sellQuotes" :key="'sell-' + index" class="sell-row"
                    :class="{ 'price-up': quote.status === 'up', 'price-down': quote.status === 'down' }"
                    @mouseover="highlightRow" @mouseleave="clearHighlightRow">
                    <td :style="{ color: 'var(--sell-quote-price-color)' }">{{ formatNumber(quote.price, true) }}</td>
                    <td>{{ formatNumber(quote.size) }}</td>
                    <td class="progress-container">
                        <div class="total">{{ formatNumber(quote.total) }}</div>
                        <div class="progress-bar"
                            :style="{ width: quote.percentage + '%', backgroundColor: 'var(--sell-quote-bar-color)' }">
                        </div>
                    </td>
                </tr>

                <!-- Last price section -->
                <tr>
                    <td colspan="3" class="last-price-cell">
                        <div class="last-price" :style="lastPriceStyle">
                            <span>{{ formatNumber(lastPrice, true) }}</span>
                            <img :src="arrowIcon" :style="{ transform: arrowTransform, filter: arrowFilter }"
                                alt="Price Direction" class="price-icon" />
                        </div>
                    </td>
                </tr>

                <!-- Render buy quotes -->
                <tr v-for="(quote, index) in buyQuotes" :key="'buy-' + index" class="buy-row"
                    :class="{ 'price-up': quote.status === 'up', 'price-down': quote.status === 'down' }"
                    @mouseover="highlightRow" @mouseleave="clearHighlightRow">
                    <td :style="{ color: 'var(--buy-quote-price-color)' }">{{ formatNumber(quote.price, true) }}</td>
                    <td>{{ formatNumber(quote.size) }}</td>
                    <td class="progress-container">
                        <div class="total">{{ formatNumber(quote.total) }}</div>
                        <div class="progress-bar"
                            :style="{ width: quote.percentage + '%', backgroundColor: 'var(--buy-quote-bar-color)' }">
                        </div>
                    </td>
                </tr>

            </tbody>
        </table>
    </div>
</template>

<script>
import { connectSocket, disconnectSocket } from "@/services/websocket";

export default {
    name: "OrderBook",
    data() {
        return {
            sellQuotes: [],
            buyQuotes: [],
            lastPrice: null,
            prevLastPrice: null,
            orderBookSocket: null,
            lastPriceSocket: null,
            prevAsks: [], // 儲存上一輪 asks 資料
            prevBids: [], // 儲存上一輪 bids 資料
        };
    },
    computed: {
        lastPriceStyle() {
            if (this.lastPrice > this.prevLastPrice) {
                return {
                    color: "var(--buy-quote-price-color)",
                    backgroundColor: "rgba(16, 186, 104, 0.12)",
                };
            } else {
                return {
                    color: "var(--sell-quote-price-color)",
                    backgroundColor: "rgba(255, 90, 90, 0.12)",
                };
            }
        },
        arrowIcon() {
            return require("@/assets/IconArrowDown.svg");
        },
        arrowTransform() {
            // 動態設置箭頭方向
            if (this.lastPrice > this.prevLastPrice) {
                return "rotate(180deg)"; // 向上箭頭
            } else {
                return "rotate(0deg)"; // 向下箭頭
            }
        },
        arrowFilter() {
            if (this.lastPrice > this.prevLastPrice) {
                return "invert(54%) sepia(69%) saturate(368%) hue-rotate(108deg) brightness(92%) contrast(85%)"; // 綠色
            } else {
                return "invert(36%) sepia(100%) saturate(717%) hue-rotate(356deg) brightness(97%) contrast(95%)"; // 紅色
            }
        },
    },
    methods: {
        formatNumber(number, isPrice = false) {
            const parsedNumber = parseFloat(number);
            const formattedNumber = new Intl.NumberFormat().format(parsedNumber);

            // Price || Last Price 為整數，補 `.0`
            if (isPrice && Number.isInteger(parsedNumber)) {
                return `${formattedNumber}.0`;
            }

            return formattedNumber;
        },
        highlightRow(event) {
            event.currentTarget.style.backgroundColor = "var(--quote-row-hover-bg-color)";
        },
        clearHighlightRow(event) {
            event.currentTarget.style.backgroundColor = "";
        },
        processOrderBook(data) {
            if (!data || !data.data || (data.data.type !== "snapshot" && data.data.type !== "delta")) {
                return;
            }

            const orderData = data.data;

            if (!Array.isArray(orderData.asks) || !Array.isArray(orderData.bids)) {
                return;
            }

            // 過濾掉 size 為 0 的項目
            const filteredAsks = orderData.asks.filter((ask) => parseFloat(ask[1]) > 0);
            const filteredBids = orderData.bids.filter((bid) => parseFloat(bid[1]) > 0);

            // 如果任何一個未滿 8 筆，則視為不完整資料，不更新畫面
            if (filteredAsks.length < 8 || filteredBids.length < 8) {
                return;
            }

            // 對 asks 和 bids 進行降冪排序並只保留前 8 筆
            const sortedAsks = filteredAsks.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).slice(0, 8);
            const sortedBids = filteredBids.sort((a, b) => parseFloat(b[0]) - parseFloat(a[0])).slice(0, 8);

            // 檢查是否為新價格
            const newAsks = sortedAsks.filter((ask) => !this.prevAsks.some((prevAsk) => prevAsk[0] === ask[0]));
            const newBids = sortedBids.filter((bid) => !this.prevBids.some((prevBid) => prevBid[0] === bid[0]));

            // 更新報價資料並添加動畫
            this.updateQuotes("asks", sortedAsks, newAsks);
            this.updateQuotes("bids", sortedBids, newBids);

            // 更新前一輪資料
            this.prevAsks = [...sortedAsks];
            this.prevBids = [...sortedBids];
        },
        updateQuotes(type, updates, newItems) {
            const flashRowColor = type === "asks" ? "flash-red-bg-color" : "flash-green-bg-color";
            const flashSizeIncreaseColor = "flash-green-bg-color";
            const flashSizeDecreaseColor = "flash-red-bg-color";

            // 清除先前的背景動畫
            document.querySelectorAll(`.${flashRowColor}, .${flashSizeIncreaseColor}, .${flashSizeDecreaseColor}`).forEach((row) => {
                row.classList.remove(flashRowColor, flashSizeIncreaseColor, flashSizeDecreaseColor);
            });

            // 更新報價
            const updatedQuotes = updates.map((update) => {
                const rawPrice = parseFloat(update[0]);
                const price = Number.isInteger(rawPrice) ? `${rawPrice}.0` : rawPrice.toString();
                const size = parseFloat(update[1]);

                // 查找是否有現有報價
                const existingIndex = (type === "asks" ? this.sellQuotes : this.buyQuotes).findIndex((quote) => quote.price === price);
                const existingQuote = existingIndex !== -1 ? (type === "asks" ? this.sellQuotes : this.buyQuotes)[existingIndex] : null;

                const newQuote = {
                    price,
                    size,
                    total: 0,
                    percentage: 0,
                    status: existingQuote ? existingQuote.status : "same",
                };

                // 如果現有報價存在，檢查 Size 是否改變
                if (existingQuote) {
                    const previousSize = parseFloat(existingQuote.size);
                    if (size > previousSize) {
                        // Size 增加，添加動畫
                        const targetRow = document.querySelectorAll(type === "asks" ? ".sell-row td:nth-child(2)" : ".buy-row td:nth-child(2)")[existingIndex];
                        if (targetRow) {
                            targetRow.classList.add(flashSizeIncreaseColor);
                            setTimeout(() => targetRow.classList.remove(flashSizeIncreaseColor), 300);
                        }
                    } else if (size < previousSize) {
                        // Size 減少，添加動畫
                        const targetRow = document.querySelectorAll(type === "asks" ? ".sell-row td:nth-child(2)" : ".buy-row td:nth-child(2)")[existingIndex];
                        if (targetRow) {
                            targetRow.classList.add(flashSizeDecreaseColor);
                            setTimeout(() => targetRow.classList.remove(flashSizeDecreaseColor), 300);
                        }
                    }
                }

                return newQuote;
            });

            // 強制保留 8 筆資料
            const finalQuotes = updatedQuotes.slice(0, 8);

            // 更新 quotes
            if (type === "asks") {
                this.sellQuotes = finalQuotes;
            } else {
                this.buyQuotes = finalQuotes;
            }

            this.updatePercentages(type);

            // 為新價格添加整行動畫
            if (Array.isArray(newItems) && newItems.length > 0) {
                newItems.forEach((newItem) => {
                    const targetIndex = finalQuotes.findIndex((quote) => quote.price === newItem[0]);
                    if (targetIndex !== -1) {
                        const targetRow = document.querySelectorAll(type === "asks" ? ".sell-row" : ".buy-row")[targetIndex];
                        if (targetRow) {
                            targetRow.classList.add(flashRowColor);
                            setTimeout(() => targetRow.classList.remove(flashRowColor), 300);
                        }
                    }
                });
            }
        },
        updatePercentages(type) {
            const targetQuotes = type === "asks" ? this.sellQuotes : this.buyQuotes;
            const totalSize = targetQuotes.reduce((sum, quote) => sum + parseFloat(quote.size), 0);

            let cumulativeSize = 0;
            if (type === "asks") {
                targetQuotes.reverse().forEach((quote) => {
                    cumulativeSize += quote.size;
                    quote.total = cumulativeSize;
                    quote.percentage = (cumulativeSize / totalSize) * 100;
                });
                targetQuotes.reverse();
            } else {
                targetQuotes.forEach((quote) => {
                    cumulativeSize += quote.size;
                    quote.total = cumulativeSize;
                    quote.percentage = (cumulativeSize / totalSize) * 100;
                });
            }
        },
        mapQuoteData(type) {
            return (quote, index, array) => {
                const totalSize = array.reduce((sum, q) => sum + parseFloat(q[1]), 0);
                let cumulativeSize;
                if (type === "sell") {
                    cumulativeSize = array
                        .slice(index)
                        .reduce((sum, q) => sum + parseFloat(q[1]), 0);
                } else {
                    cumulativeSize = array
                        .slice(0, index + 1)
                        .reduce((sum, q) => sum + parseFloat(q[1]), 0);
                }
                const price = parseFloat(quote[0]);
                return {
                    price: Number.isInteger(price) ? `${price}.0` : price.toString(),
                    size: parseFloat(quote[1]),
                    total: cumulativeSize,
                    percentage: (cumulativeSize / totalSize) * 100,
                };
            };
        },
        processLastPrice(data) {
            if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
                const lastTrade = data.data[0];
                this.prevLastPrice = this.lastPrice || 0;
                this.lastPrice = parseFloat(lastTrade.price);
            }
        },
    },
    mounted() {
        this.orderBookSocket = connectSocket(
            "wss://ws.btse.com/ws/oss/futures",
            "orderBook",
            this.processOrderBook
        );
        this.lastPriceSocket = connectSocket(
            "wss://ws.btse.com/ws/futures",
            "lastPrice",
            this.processLastPrice
        );
    },
    beforeUnmount() {
        disconnectSocket(this.orderBookSocket);
        disconnectSocket(this.lastPriceSocket);
    },
};
</script>

<style scoped>
h1 {
    text-align: left;
}

.order-book {
    width: 360px;
    background-color: var(--background-color);
    color: var(--default-text-color);
    padding: 0 1rem;
}

table {
    width: 100%;
    border-collapse: collapse;
}

th {
    width: 120px;
}

th,
td {
    width: 33.33%;
    text-align: right;
    padding: 0.1rem;
}

td {
    white-space: nowrap;
    position: relative;
}

.progress-container {
    position: relative;
}

.progress-bar {
    height: 26px;
    border-radius: 5px;
    margin-top: 5px;
    position: absolute;
    right: 0;
    bottom: 5px;
}

.total {
    margin-bottom: 5px;
    text-align: right;
}

.last-price-cell {
    text-align: center;
    padding: 5px 0;
    background-color: var(--background-color);
}

.last-price {
    font-size: 1.5rem;
    font-weight: bold;
}

.price-up {
    color: var(--buy-quote-price-color);
    background-color: rgba(16, 186, 104, 0.12);
}

.price-down {
    color: var(--sell-quote-price-color);
    background-color: rgba(255, 90, 90, 0.12);
}

.price-icon {
    width: 16px;
    height: 16px;
    margin-left: 4px;
    vertical-align: middle;
}

@keyframes flash {
    0% {
        background-color: var(--flash-red-bg-color);
    }

    100% {
        background-color: transparent;
    }
}

.flash-red-bg-color {
    animation: flash-red 0.3s ease-in-out;
}

@keyframes flash-red {
    0% {
        background-color: var(--flash-red-bg-color);
    }

    100% {
        background-color: transparent;
    }
}

.flash-green-bg-color {
    animation: flash-green 0.3s ease-in-out;
}

@keyframes flash-green {
    0% {
        background-color: var(--flash-green-bg-color);
    }

    100% {
        background-color: transparent;
    }
}
</style>
