"use strict";

/*  ------------------------------------------------------------------------ */

    const log       = require ('ololog'),
          ansi      = require ('ansicolor').nice,
          fs        = require ('fs'),
          stringify = require ('string.ify')

/*  ------------------------------------------------------------------------ */

    const [, , configFile = './config.json'] = process.argv.filter (x => x !== 'index.js') // nodemon incorrectly passes index.js occasionally

    log.cyan ('Reading config from', configFile.bright)

    const config = JSON.parse (fs.readFileSync (configFile, { encoding: 'utf-8' }))

    const saveConfig = () => {

        fs.writeFileSync (configFile, stringify.json (config), { encoding: 'utf-8' })
    }

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

    async function* newCommits ({ dir, lastTopCommitHash }) {

        log.cyan ('Watching for new commits in', dir.bright, 'starting from', (lastTopCommitHash || 'top').bright)

        while (true) {

            const commits = parseGitLog (await exec (`cd ${dir.replace (/^\\\s/g, '\\ ')} && git fetch && git log --all`))

            if (lastTopCommitHash) {

                if (!commits.find (c => c.hash === lastTopCommitHash)) {

                    fatal (`Invalid state of ${dir}: no commit with hash ${lastTopCommitHash} found`)
                }

                for (let commit of commits) { // yield new commits since lastTopCommitHash

                    if (commit.hash === lastTopCommitHash) {

                        break;

                    } else {

                        yield commit
                    }
                }
            }

            lastTopCommitHash = commits[0].hash

            saveConfig () // writes lastTopCommitHash change

            await sleep (config.fetchFrequency)
        }
    }

/*  ------------------------------------------------------------------------ */

    const slack = new (require ('@slack/client').WebClient) (config.accessToken);
    
/*  ------------------------------------------------------------------------ */

    async function watch ({ name, dir, channel = 'general', lastTopCommitHash = '' }) {

        for await (let commit of newCommits ({ name, dir, lastTopCommitHash })) {

            log.bright.green (commit)

            slack.chat.postMessage (channel, `:loudspeaker: [${name}] new commit by \`${commit.Author.split (' ')[0]}\`: *${commit.comment}*` , (err, res) => {

                if (err) { fatal (err) }
            })
        }
    };

/*  ------------------------------------------------------------------------ */

    config.repos.forEach (repo => watch (repo).catch (fatal))

/*  ------------------------------------------------------------------------ */
