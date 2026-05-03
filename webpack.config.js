const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';

const baseTsRule = {
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/,
};

module.exports = [
    {
        name: 'main',
        mode: isProduction ? 'production' : 'development',
        entry: './src/main/main.ts',
        target: 'electron-main',
        devtool: isProduction ? false : 'source-map',
        module: {
            rules: [baseTsRule],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        output: {
            path: path.resolve(__dirname, 'dist/main'),
            filename: 'main.js',
        },
    },
    {
        name: 'preload',
        mode: isProduction ? 'production' : 'development',
        entry: './src/preload/preload.ts',
        target: 'electron-preload',
        devtool: isProduction ? false : 'source-map',
        module: {
            rules: [baseTsRule],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        output: {
            path: path.resolve(__dirname, 'dist/preload'),
            filename: 'preload.js',
        },
    },
    {
        name: 'renderer',
        mode: isProduction ? 'production' : 'development',
        entry: './src/renderer/renderer.tsx',
        target: 'electron-renderer',
        devtool: isProduction ? false : 'source-map',
        module: {
            rules: [
                baseTsRule,
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader'],
                },
                {
                    test: /\.(png|svg|jpg|jpeg|gif)$/i,
                    type: 'asset/resource',
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.tsx', '.js', '.jsx'],
        },
        output: {
            path: path.resolve(__dirname, 'dist/renderer'),
            filename: 'renderer.js',
        },
        plugins: [
            new HtmlWebpackPlugin({
                template: './src/renderer/index.html',
                filename: 'index.html',
            }),
        ],
    },
];
