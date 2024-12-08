const RECONNECT_DELAY = 5000;
const HEARTBEAT_INTERVAL = 30000;
const SUBSCRIPTION_MESSAGES = {
    orderBook: JSON.stringify({
        op: "subscribe",
        args: ["update:BTCPFC"],
    }),
    lastPrice: JSON.stringify({
        op: "subscribe",
        args: ["tradeHistoryApi:BTCPFC"],
    }),
};

/**
 * 建立 WebSocket 連線
 * @param {string} url
 * @param {string} topic - ('orderBook' 或 'lastPrice')
 * @param {function} callback
 * @returns {WebSocket}
 */
export const connectSocket = (url, topic, callback) => {
    if (!SUBSCRIPTION_MESSAGES[topic]) {
        console.error(`Unknown topic: ${topic}`);
        return null;
    }

    const socket = new WebSocket(url);
    let heartbeatInterval;
    let reconnectTimeout;

    socket.onopen = () => {
        socket.send(SUBSCRIPTION_MESSAGES[topic]);

        heartbeatInterval = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ op: "ping" }));
            }
        }, HEARTBEAT_INTERVAL);
    };

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            callback(data);
        } catch (error) {
            console.error("Error parsing WebSocket message:", error, "Raw message:", event.data);
        }
    };

    socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        clearInterval(heartbeatInterval);
        attemptReconnect(socket, url, topic, callback, reconnectTimeout);
    };

    socket.onclose = () => {
        clearInterval(heartbeatInterval);
        attemptReconnect(socket, url, topic, callback, reconnectTimeout);
    };

    return socket;
};

/**
 * 嘗試重新連接
 * @param {WebSocket} socket
 * @param {string} url
 * @param {string} topic
 * @param {function} callback
 * @param {number} reconnectTimeout - 用於重連的 Timeout ID
 */
const attemptReconnect = (socket, url, topic, callback, reconnectTimeout) => {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(() => {
        connectSocket(url, topic, callback);
    }, RECONNECT_DELAY);
};

/**
 * 關閉
 * @param {WebSocket} socket
 */
export const disconnectSocket = (socket) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
    }
};
