"use strict";

/*  ------------------------------------------------------------------------ */

    const log       = require ('ololog'),
          ansi      = require ('ansicolor').nice,
          fs        = require ('fs'),
          path      = require ('path')

/*  ------------------------------------------------------------------------ */

    const fatal = (...args) => (log.bright.red.error ('\n', ...args, '\n'), process.exit (0))

/*  ------------------------------------------------------------------------ */

    const prettyPrintJSON = x => JSON.stringify (x, null, 4)

/*  ------------------------------------------------------------------------ */

    const [processPath, , configFile = './config.json'] = process.argv.filter (x => x !== 'index.js') // nodemon incorrectly passes index.js occasionally

    if (!fs.existsSync (configFile)) {

        log.green ('No', configFile.white.bright, 'found, so we filled it with the example data.', 'Check it out, edit and re-start.\n'.bright)

        fs.writeFileSync (configFile, prettyPrintJSON ({

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

    log.cyan ('Reading config from', configFile.bright)

    const config = JSON.parse (fs.readFileSync (configFile, { encoding: 'utf-8' }))

    if (!config.accessToken || config.accessToken === '<your Slack OAuth access token here>') {

        fatal (`You should specify a valid OAuth ${'accessToken'.white} — get one at ${'http://slack.com/api'.cyan}`)
    }

    for (const repo of config.repos) {

        if (!repo.dir) {
            fatal (`You should specify a ${'dir'.white} for your repository: ${JSON.stringify (repo).yellow}`)
        }

        if (!repo.name) {
            repo.name = path.basename (repo.dir)
        }
    }

    const saveConfig = () => fs.writeFileSync (configFile, prettyPrintJSON (config), { encoding: 'utf-8' })

    saveConfig ()

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

    async function* newCommits (repo) {

        const { dir } = repo

        log.cyan ('Watching for new commits in', dir.bright, 'starting from', (repo.lastTopCommitHash || 'top').bright)

        while (true) {

            const commits = parseGitLog (await exec (`cd ${dir.replace (/^\\\s/g, '\\ ')} && git fetch && git log --all`))

            if (repo.lastTopCommitHash) {

                const lastTopCommitIndex = commits.findIndex (c => c.hash === repo.lastTopCommitHash)

                if (lastTopCommitIndex < 0) {

                    fatal (`Invalid state of ${dir}: no commit with hash ${repo.lastTopCommitHash} found. Try removing it from the config file.`)
                }

                for (let commit of commits.slice (0, lastTopCommitIndex).reverse ()) { // yield new commits since lastTopCommitHash

                    if (commit.hash === repo.lastTopCommitHash) {

                        break;

                    } else {

                        yield commit
                    }
                }
            }

            if (commits[0] && (repo.lastTopCommitHash != commits[0].hash)) {

                repo.lastTopCommitHash = commits[0].hash

                saveConfig ()
            }

            await sleep (config.fetchFrequency)
        }
    }

/*  ------------------------------------------------------------------------ */

    const slack = new (require ('@slack/client').WebClient) (config.accessToken);
    
    const postSlackMessage = (...args) => new Promise ((return_, throw_) => slack.chat.postMessage (...args, (e, x) => e ? throw_ (e) : return_ (x)))

/*  ------------------------------------------------------------------------ */

    const muted = ({ comment }) => comment.match (/^\d+\.\d+\.\d+$/) || // NPM version numbers
                                   comment === 'Update README.md'       // GitHub online editor

/*  ------------------------------------------------------------------------ */

    async function watch (repo) {

        const { name, dir, channel = 'general', lastTopCommitHash = '' } = repo

        for await (let commit of newCommits (repo)) {

            if (muted (commit)) { // filters out automatically generated garbage

                log.dim.green (commit)

            } else {

                log.bright.green (commit)

                await postSlackMessage (channel, `:loudspeaker: [${name}] new commit by \`${commit.Author.split (' ')[0]}\`: *${commit.comment}*`)
            }
        }
    };

/*  ------------------------------------------------------------------------ */

    config.repos.forEach (repo => watch (repo).catch (fatal))

/*  ------------------------------------------------------------------------ */
