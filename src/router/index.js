import Vue from 'vue'
import Router from 'vue-router'
import Recognize from '@/components/recognize'

Vue.use(Router)

export default new Router({
  routes: [
    {
      path: '/',
      name: 'Recognize',
      component: Recognize
    }
  ]
})
