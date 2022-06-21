import Vue from 'vue'
import App from './App'
import store from './store'
import router from './router/router.js'
import '@/styles/reset.css'
Vue.config.productionTip = false

new Vue({
  el: '#app',
  router,
  store,
  components: {
    App,
  },
  template: '<App/>',
  render: h => h(App)
})

