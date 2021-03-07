import { babel } from '@rollup/plugin-babel';
import commonjs from '@rollup/plugin-commonjs';
import external from 'rollup-plugin-peer-deps-external'
//import postcss from 'rollup-plugin-postcss'
import { nodeResolve } from '@rollup/plugin-node-resolve';

import pkg from './package.json'

export default {
    input: 'src/index.js',
    output: [
        {
            file: pkg.main,
            format: 'cjs'
        },
        {
            file: pkg.module,
            format: 'es'
        }
    ],
    plugins: [
        external(),
        // postcss({
        //     modules: true
        // }),,
        nodeResolve(),
        commonjs({
            //exclude: 'src/**',
            include: 'node_modules/**'
        }),
        babel({
            babelHelpers: 'runtime',
            exclude: /node_modules/,
            //exclude: 'node_modules/**'
        }),
        [
            "@babel/plugin-transform-runtime",
            {
                "absoluteRuntime": false,
                "corejs": false,
                "helpers": true,
                "regenerator": true,
                "version": "7.0.0-beta.0"
            }
        ]
    ],
    external: Object.keys(pkg.peerDependencies || {})
}