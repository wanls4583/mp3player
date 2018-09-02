var path = require('path');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var webpack = require('webpack');
var CopyWebpackPlugin = require('copy-webpack-plugin');

// 拼接我们的工作区路径为一个绝对路径
function resolve(dir) {
    return path.join(__dirname, dir);
}

module.exports = {
    devtool: '#cheap-module-eval-source-map',
    entry: {
        'demo1': './src/example/demo1.js',
        'demo2': './src/example/demo2.js'
    },
    output: {
        // 编译输出的根路径
        path: resolve('dist/example'),
        // 编译输出的文件名
        filename: '[name].min.js',
    },
    devServer: {
        contentBase: resolve('dist/example'),
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
            filename: 'demo1.html',
            template: resolve('src/example/demo1.html'),
            chunks: ['demo1'],
            inject: true 
        }),
        new HtmlWebpackPlugin({
            filename: 'demo2.html',
            template: resolve('src/example/demo2.html'),
            chunks: ['demo2'],
            inject: true
        }),
        new CopyWebpackPlugin([
            {
                from: 'src/example/',
                to: './'
            }
        ],{
            ignore: ['demo1.js','demo2.js','demo1.html','demo2.html']
        })
    ]
}