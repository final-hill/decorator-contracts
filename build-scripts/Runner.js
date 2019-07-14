//@ts-check

const { spawnSync } = require("child_process");

module.exports = class Runner {
    /**
     * 
     * @param {string} command 
     * @param {string[]} args 
     * @param {*} options 
     */
    constructor(command, args = [], options = {}) {
        this.command = command
        this.continueOnFail = options.continueOnFail
        this.cwd = options.cwd
        this.args = args.slice()
        this.options = Object.create(options)
    }

    run() {
        console.log(this.command, this.args.join(' '))

        const prog = spawnSync(this.command, this.args, this.options)
        if (prog.status !== 0) {
            if (!this.continueOnFail) {
              console.log(prog.stdout && prog.stdout.toString())
              console.error(prog.stderr && prog.stderr.toString())
              process.exit(1)
            }
          }

          return prog
    }

    runAsync() {
        // TODO
    }
}

/*
function runAsync(command, args = [], options = {}) {
    let { continueOnFail, verbose, ...cmdOptions } = options
    if (verbose) {
      console.log(command, args.join(' '))
    }
    return new Promise((resolve, reject) => {
      const prog = spawn(command, args, cmdOptions)
      let stderr = ''
      let stdout = ''
      prog.stderr.on('data', data => {
        stderr += data
      })
      prog.stdout.on('data', data => {
        stdout += data
      })
      prog.on('close', statusCode => {
        const hasFailed = statusCode !== 0
        if (verbose && (!hasFailed || continueOnFail)) {
          console.log(stdout)
          if (stderr) {
            console.error(stderr)
          }
        }
        if (hasFailed) {
          const err = new Error(`Program ${command} exited with error code ${statusCode}.`)
          err.stderr = stderr
          err.stdout = stdout
          reject(err)
          if (!continueOnFail) {
            console.log(err.message)
            console.log(stdout)
            console.error(stderr)
            process.exit(1)
          }
          return
        }
        resolve(stdout)
      })
    })
}*/