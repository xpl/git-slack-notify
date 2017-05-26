"use strict";

/*  ------------------------------------------------------------------------ */

    const log    = require ('ololog'),
          ansi   = require ('ansicolor').nice,
          config = require ('./config')

/*  ------------------------------------------------------------------------ */

    const fatal = (...args) => (log.bright.red.error (...args), process.exit (1))

/*  ------------------------------------------------------------------------ */

    const exec = cmd => new Promise (resolve => {

                            log.dim.cyan ('> '.bright + cmd)

                            require ('child_process').exec (cmd, (err, stdout, stderr) => {
                                if (err) { fatal (stderr) }
                                else { resolve (stdout) }
                            })
                        })

/*  ------------------------------------------------------------------------ */

    const parseGitLog = stdout => stdout.split (/^commit /m).map (entry =>

        entry.split ('\n').map ((line, i) => {

            if (i === 0) return { hash: line }
            else if (line.indexOf ('    ') === 0) { return { comment: line.slice (4) } }
            else { try { const [,key,value] = line.match (/^(.+)\:\s+(.*)$/); return { [key]: value } } catch (e) { } }
            return {}

        }).reduce ((a, b) => Object.assign (a, b), {})

    ).filter (c => c.hash)

/*  ------------------------------------------------------------------------ */

    const sleep = ms => new Promise (resolve => setTimeout (resolve, ms))

/*  ------------------------------------------------------------------------ */

    async function* newCommits (dir) {

        let prevCommits = null

        while (true) {

            const newCommits = parseGitLog (await exec (`cd ${dir.replace (/^\\\s/g, '\\ ')} && git fetch && git log --all`))

            if (prevCommits) { // yield all new commits (if any)

                for (let i = 0; (newCommits[i].hash !== prevCommits[0].hash) && (i < newCommits.length); i++) {

                    yield newCommits[i]
                }
            }

            prevCommits = newCommits

            await sleep (config.fetchFrequency)
        }
    }

/*  ------------------------------------------------------------------------ */

    const slack = new (require ('@slack/client').WebClient) (config.accessToken);
    
/*  ------------------------------------------------------------------------ */

    async function watch ({ name, dir, channel = 'general' }) {

        log.bright.cyan (`Watching for new commits in ${dir}...`)

        for await (let commit of newCommits (dir)) {

            log.bright.green (commit)

            slack.chat.postMessage (channel, `:loudspeaker: [${name}] new commit by \`${commit.Author.split (' ')[0]}\`: *${commit.comment}*` , (err, res) => {

                if (err) { fatal (err) }
            })
        }
    };

/*  ------------------------------------------------------------------------ */

    config.repos.forEach (repo => watch (repo).catch (fatal))

/*  ------------------------------------------------------------------------ */
