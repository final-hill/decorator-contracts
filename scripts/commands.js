// @ts-check
const program = require('commander')
const { spawnSync } = require('child_process')
const fs = require('fs')

/**
 * @param {string} cmd 
 * @param {string[]} args 
 * @param { import('child_process').SpawnSyncOptionsWithStringEncoding} options 
 */
function run(cmd, args = [], options = {encoding : 'utf8'}) {
    // console.log(cmd, args.join(' '))
    const prog = spawnSync(cmd, args, options)
    if (prog.status !== 0) {
        console.log(prog.stdout && prog.stdout.toString())
        console.error(prog.stderr && prog.stderr.toString())
        process.exit(1)
    }
    return prog
}

program
    .command('build-changelog')
    .action(() => {
        console.log('Build CHANGELOG.md')
        let prog = run('git', ['tag', '-n99', '-l', 'v*.*.*', '--sort=-v:refname']),
            stdout = (prog.stdout && prog.stdout.toString() || '') + '\n',
            tags = stdout.matchAll(/(v\d+\.\d+\.\d+)((?:\s+[^\n]*[\n])+)/g),
            reTrimLines = /^\s*([\S\s]*?)\s*$/gm;

        let txtChangelog = `# Changelog\r\n\r\n${
            [...tags].map(([, tag, description]) =>
                `## ${tag}\r\n\r\n${description.replace(reTrimLines,'$1')}\r\n`
            ).join('\r\n')
        }`

        fs.writeFile('./CHANGELOG.md',txtChangelog, function(err){
            if(err)
                console.error(err)
            else
                console.log('CHANGELOG.md created')
        })
    })

program.parse(process.argv)