const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = [
    // Main Process Configuration
    {
        mode: 'development',
        entry: './src/main/main.ts',
        target: 'electron-main',
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        output: {
            path: path.resolve(__dirname, 'dist/main'),
            filename: 'main.js',
        },
    },

    // Preload Process Configuration
    {
        mode: 'development',
        entry: './src/preload/preload.ts',
        target: 'electron-preload',
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
            ],
        },
        resolve: {
            extensions: ['.ts', '.js'],
        },
        output: {
            path: path.resolve(__dirname, 'dist/preload'),
            filename: 'preload.js',
        },
    },

    // Renderer Process Configuration
    {
        mode: 'development',
        entry: './src/renderer/renderer.tsx',
        target: 'electron-renderer',
        devtool: 'source-map',
        module: {
            rules: [
                {
                    test: /\.(ts|tsx)$/,
                    use: 'ts-loader',
                    exclude: /node_modules/,
                },
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
