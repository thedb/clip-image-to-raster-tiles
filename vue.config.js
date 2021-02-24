const ThreadsPlugin = require('threads-plugin')

module.exports = {
  publicPath: './',
  runtimeCompiler: false,
  productionSourceMap: true,
  devServer: {
    host: '0.0.0.0',
    port: 8080,
    https: false,
    hotOnly: true,
    // proxy: 'https://aip.baidubce.com',
    proxy: 'http://127.0.0.1:7001',
    // 这会告诉开发服务器将任何未知请求 (没有匹配到静态文件的请求) 代理到http://localhost:4000。
    proxy: 'https://aip.baidubce.com', // string | Object 代理
  },
  configureWebpack: config => {
    return {
      plugins: [new ThreadsPlugin()]
    }
  }
}