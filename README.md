# How order-book Works

```
Real-time Data Flow
WebSocket Connection:

The project connects to two WebSocket endpoints:
OrderBook data (wss://ws.btse.com/ws/oss/futures)
Last trade price (wss://ws.btse.com/ws/futures)

Data Processing:
Filters incoming data to remove incomplete or invalid entries.
Ensures that the asks and bids tables always display the top 8 valid rows.

UI Updates:
Adds animations for row updates based on price or size changes.
Dynamically updates total and percentage columns based on cumulative size.
```

## Project setup

```
npm install
```

### Compiles and hot-reloads for development

```
npm run serve
```

### Compiles and minifies for production

```
npm run build
```

### Lints and fixes files

```
npm run lint
```

### Customize configuration

See [Configuration Reference](https://cli.vuejs.org/config/).
