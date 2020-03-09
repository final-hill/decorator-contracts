// @ts-check
const program = require('commander')

program
    .command('build-changelog')
    .action(() => {
        // git tag -n99 -l 'v*.*.*' --sort=v:refname
        console.log('Build Changelog')
    })

program.parse(process.argv)