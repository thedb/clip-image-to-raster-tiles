import { 
  createRouter, 
  createWebHashHistory,
} from 'vue-router'
import thread from '../views/thread.vue'


const routes = [
  {
    path: '/thread',
    name: 'thread',
    component: thread,
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes, 
})
export default router
