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

        fatal (`You should specify a valid OAuth ${'accessToken'.white} — get one at ${'https://api.slack.com/'.cyan}`)
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

                            //log.dim.cyan ('> '.bright + cmd)

                            require ('child_process').exec (cmd, {maxBuffer: 1024 * 1024}, (err, stdout, stderr) => {
                                if (err) { fatal (`${cmd} failed: ${err}, stderr output: ${stderr}`) }
                                else { resolve (stdout) }
                            })
                        })

/*  ------------------------------------------------------------------------ */

    const parseGitLog = stdout =>

        stdout.split (/^commit /m).map (text => {

            const [headers, message = ''] = text.split ('\n\n')

            const props = headers.split ('\n')
                                 .map ((line, i) => {
                                    if (i === 0) return { hash: line }
                                    else { try { const [,key,value] = line.match (/^(.+)\:\s+(.*)$/); return { [key]: value } } catch (e) { } }
                                    return {}
                                 })
                                 .reduce ((a, b) => ({ ...a, ...b }), {})

            return props.hash && {
                ...props,
                author: props.Author.match (/^(.*)\s<.+>$/)[1],
                message: message.split ('\n')[0].trim ()
            }
        })
        .filter (c => c)

/*  ------------------------------------------------------------------------ */

    const sleep = ms => new Promise (resolve => setTimeout (resolve, ms))

/*  ------------------------------------------------------------------------ */

    async function* newCommits (repo) {

        const { dir } = repo

        log.cyan ('Watching for new commits in', dir.bright, 'starting from', (repo.lastTopCommitHash || 'top').bright)

        while (true /* this is OK due to the asynchronous nature of this function */) {

            const since = repo.lastTopCommitHash ? repo.lastTopCommitHash + '..' : ''
                , commits = parseGitLog (await exec (`cd ${dir.replace (/^\\\s/g, '\\ ')} && git fetch && git log --all --reverse --author-date-order ${since}`))

            if (commits.length) {
                if (repo.lastTopCommitHash) { // DO NOT report if launched first time (when lastTopCommitHash is yet to determine...)
                    for (const commit of commits) yield commit
                }
                repo.lastTopCommitHash = commits[commits.length - 1].hash
                saveConfig ()
            }

            await sleep (config.fetchFrequency)
        }
    }

/*  ------------------------------------------------------------------------ */

    const slack = new (require ('@slack/client').WebClient) (config.accessToken);
    
    const postSlackMessage = (...args) => new Promise ((return_, throw_) => slack.chat.postMessage (...args, (e, x) => e ? throw_ (e) : return_ (x)))

/*  ------------------------------------------------------------------------ */

    const muted = ({ message }) => message.match (/^\d+\.\d+\.\d+$/)   ||  // NPM version numbers
                                   message.match (/^Update (.+)\.md$/i) || // GitHub online editor's default message
                                   message.startsWith ('Merge branch')     // auto-generated merge commits

/*  ------------------------------------------------------------------------ */

    async function watch (repo) {

        const { name, dir, channel = 'general', lastTopCommitHash = '' } = repo

        for await (let commit of newCommits (repo)) {

            if (muted (commit)) { // filters out automatically generated garbage and other non-informative stuff

                log.dim.green (commit)

            } else {

                log.bright.green (commit)

                await postSlackMessage (channel, `:loudspeaker: [${name}] new commit by \`${commit.author}\`: *${commit.message}*`)
            }
        }
    };

/*  ------------------------------------------------------------------------ */

    config.repos.forEach (repo => watch (repo).catch (fatal))

/*  ------------------------------------------------------------------------ */
