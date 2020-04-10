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

/**
 * Deletes the provided paths if they exist
 * 
 * @param {string[]} paths - Array of file paths
 */
function clean(paths) {
    paths.forEach(path => {
        console.log(`deleting ${path}`)

        if(fs.existsSync(path)) {
            if(fs.lstatSync(path).isDirectory()) {
                fs.rmdirSync(path, {recursive: true});
            } else {
                fs.unlink(path, (err) => {
                    if(err) return console.error(err);
               });
            }
        }
    })
}

program
    .command('clean')
    .action(() => {
        let paths = ['./dist', './coverage', './CHANGELOG.md']
        clean(paths)
    })

program
    .command('clean-full')
    .action(() => {
        let paths = ['./.cache', './node_modules', './dist', './coverage', './CHANGELOG.md']
        clean(paths)
    })

program.parse(process.argv)