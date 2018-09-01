var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var webpack = require('webpack');
var uglify = require('uglifyjs-webpack-plugin');
var CopyWebpackPlugin = require('copy-webpack-plugin');

// 拼接我们的工作区路径为一个绝对路径
function resolve(dir) {
    return path.join(__dirname, dir);
}

module.exports = {
    devtool: '#cheap-module-eval-source-map',
    entry: {
        audiocontext: './src/example/audiocontext/demo.js',
        mediasource: './src/example/mediasource/demo.js'
    },
    output: {
        // 编译输出的根路径
        path: resolve('dist/example'),
        // 编译输出的文件名
        filename: '[name].min.js',
        // 正式发布环境下编译输出的发布路径
        // publicPath: './'
    },
    devServer: {
        contentBase: resolve('src/example'),
        historyApiFallback: true,
        hot: true,
        inline: true,
        progress: true,
        port: 9090 //端口你可以自定义
    },
    resolve: {
        // 自动补全的扩展名
        extensions: ['.js'],
        modules: [
            resolve('src'),
            resolve('node_modules')
        ]
    },
    module: {
        rules: [{
            test: /\.js$/,
            loader: 'babel-loader',
            include: [resolve('src'), resolve('test')]
        }, {
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        }]
    },
    plugins: [
        new HtmlWebpackPlugin({
            filename: 'audiocontext/index.html',
            template: resolve('src/example/audiocontext/index.html'),
            chunks: ['audiocontext'],
            inject: true 
        }),
        new HtmlWebpackPlugin({
            filename: 'mediasource/index.html',
            template: resolve('src/example/mediasource/index.html'),
            chunks: ['mediasource'],
            inject: true
        }),
        new CopyWebpackPlugin([
            {
                from: 'src/example/',
                to: './'
            }
        ],{
            ignore: ['demo.js','index.html']
        })
        // new uglify()
    ]
}