"use strict";

/*  ------------------------------------------------------------------------ */

    const log       = require ('ololog'),
          ansi      = require ('ansicolor').nice,
          fs        = require ('fs'),
          stringify = require ('string.ify'),
          path      = require ('path')

/*  ------------------------------------------------------------------------ */

    const [processPath, , configFile = './config.json'] = process.argv.filter (x => x !== 'index.js') // nodemon incorrectly passes index.js occasionally

    log.cyan ('Reading config from', configFile.bright)

    if (!fs.existsSync (configFile)) {

        log.green ('No', configFile.bright, 'found, so we filled it with the example data.', 'Check it out, edit and re-start.'.bright)

        fs.writeFileSync (configFile, stringify.json ({

            accessToken: '<your Slack OAuth access token here>',

            fetchFrequency: 30000, // check for new commits each 30s

            repos: [
                {
                    name: 'Git Slack Notify',           // display name
                    dir: process.cwd (),                // local git repo path
                    channel: 'general'                  // where to post
                }
            ]
        }))

        process.exit ()
    }

    const config = JSON.parse (fs.readFileSync (configFile, { encoding: 'utf-8' }))

    const saveConfig = () => {

        fs.writeFileSync (configFile, stringify.json (config), { encoding: 'utf-8' })
    }

/*  ------------------------------------------------------------------------ */

    const fatal = (...args) => (log.bright.red.error (...args), process.exit (1))

/*  ------------------------------------------------------------------------ */

    const exec = cmd => new Promise (resolve => {

                            log.dim.cyan ('> '.bright + cmd)

                            require ('child_process').exec (cmd, {maxBuffer: 1024 * 1024}, (err, stdout, stderr) => {
                                if (err) { fatal (`${cmd} failed: ${err}, stderr output: ${stderr}`) }
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

                    fatal (`Invalid state of ${dir}: no commit with hash ${lastTopCommitHash} found. Try removing it from the config file.`)
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

            await sleep (config.fetchFrequency)
        }
    }

/*  ------------------------------------------------------------------------ */

    const slack = new (require ('@slack/client').WebClient) (config.accessToken);
    
/*  ------------------------------------------------------------------------ */

    const muted = ({ comment }) => comment.match (/^\d+\.\d+\.\d+$/) // NPM version numbers

/*  ------------------------------------------------------------------------ */

    async function watch (repo) {

        const { name, dir, channel = 'general', lastTopCommitHash = '' } = repo

        for await (let commit of newCommits ({ name, dir, lastTopCommitHash })) {

            if (muted (commit)) { // filters out automatically generated garbage

                log.dim.green (commit)

            } else {

                log.bright.green (commit)

                slack.chat.postMessage (channel, `:loudspeaker: [${name}] new commit by \`${commit.Author.split (' ')[0]}\`: *${commit.comment}*` , (err, res) => {

                    if (err) {

                        fatal (err)

                    } else {

                        repo.lastTopCommitHash = commit.hash

                        saveConfig ()
                    }
                })
            }
        }
    };

/*  ------------------------------------------------------------------------ */

    config.repos.forEach (repo => watch (repo).catch (fatal))

/*  ------------------------------------------------------------------------ */
