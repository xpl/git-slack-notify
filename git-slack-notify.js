"use strict";

/*  ------------------------------------------------------------------------ */

    const log    = require ('ololog'),
          ansi   = require ('ansicolor').nice,
          config = require (process.argv[2] || './config')

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

        const path = require ('path'),
              fs   = require ('fs')

        const state = path.join (process.cwd (), './state') // it would be cool if we just had the persistence at the language level, e.g "let persist lastHash = ..."

        let lastTopCommitHash = fs.readFileSync (state, { encoding: 'utf-8' })

        log.cyan ('Starting from', lastTopCommitHash)

        while (true) {

            const commits = parseGitLog (await exec (`cd ${dir.replace (/^\\\s/g, '\\ ')} && git fetch && git log --all`))

            if (lastTopCommitHash) {

                if (!commits.find (c => c.hash === lastTopCommitHash)) {

                    fatal ('Invalid state: no commit with lastTopCommitHash found (try clearing the ./state file)')
                }

                for (let commit of commits) { // yield new commits since lastTopCommitHash

                    if (commit.hash === lastTopCommitHash) {

                        break;

                    } else {

                        yield commit
                    }
                }
            }

            fs.writeFileSync (state, lastTopCommitHash = commits[0].hash)

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
