// @ts-check
const program = require('commander');
const path = require('path')
const fs = require('fs-extra')
const Runner = require('./Runner');

program
    .version(process.env.npm_package_version)

program
    .command('clean')
    .description('deletes the dist folder')
    .action(function () {
        let dirDist = path.join(__dirname, '../dist')
        console.log(`cleaning: ${dirDist}`)
        fs.removeSync(dirDist)
    })

program
    .command('clean-full')
    .description('deletes the dist folder and the node_modules folder')
    .action(function () {
        let dirDist = path.join(__dirname, '../dist')
        let dirNodeModules = path.join(__dirname, '../node_modules')
        console.log(`cleaning: ${dirDist}`)
        fs.removeSync(dirDist)
        console.log(`cleaning: ${dirNodeModules}`)
        fs.removeSync(dirNodeModules)
    })

program
    .command('build')
    .description('Compiles the project')
    .action(function () {
        fs.ensureDirSync(
            path.join(__dirname, '../dist'),
        )

        // TODO: assumes windows. use npx?
        let tscPath = path.join(__dirname, '../node_modules/.bin/tsc.cmd')
        let tscRunner = new Runner(tscPath, ['-p', './tsconfig.json'])
        tscRunner.run()



        // TODO: copy, clean, and remove devDependencies from package.json
    })

program
    .parse(process.argv)