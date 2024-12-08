<template>
  <div id="app">
    <OrderBook />
  </div>
</template>

<script>
import OrderBook from './components/OrderBook.vue';

export default {
  name: 'App',
  components: {
    OrderBook
  }
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>
