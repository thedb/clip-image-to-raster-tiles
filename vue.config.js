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
    proxy: 'http://127.0.0.1:7001',
    overlay: {
      warnings: false, //不显示警告
      errors: false	//不显示错误
    }
  },
  configureWebpack: config => {
    return {
      plugins: [new ThreadsPlugin()]
    }
  }
}