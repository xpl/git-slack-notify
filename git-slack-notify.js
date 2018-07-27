"use strict";

/*  ------------------------------------------------------------------------ */

    const log       = require ('ololog').handleNodeErrors (),
          ansi      = require ('ansicolor').nice,
          fs        = require ('fs'),
          path      = require ('path'),
          testMode  = process.argv.includes ('--test'),
          http      = require ('http')

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

        if (process.argv.includes ('--reset')) {
            log.yellow (`Reseting "since" for ${repo.name.bright}`)
            delete repo.since
        }
    }

    const saveConfig = () => (!testMode ? fs.writeFileSync (configFile, prettyPrintJSON (config), { encoding: 'utf-8' }) : undefined)
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

    const parseGitLog = stdout => {

        return stdout
                .split ('\u0000')
                .map (text => text
                                .split ('\n')
                                .reduce ((commit, line, i) => {
                                    if (i === 0) commit.hash = line
                                    else if (line.startsWith ('author')) {
                                        try {
                                            const [,author,timestamp,timezone] = line.match (/author (.+) \<.+\> (\d+)( [+-]\d+)/)
                                            commit.author = author
                                            commit.authorTimestamp = Number (timestamp)
                                        } catch (e) {
                                            log.bright.red.error ('Failed to parse:', line)
                                            throw e
                                        }
                                    }
                                    else if (line.startsWith ('committer')) {
                                        try {
                                            const [,committer,timestamp,timezone] = line.match (/committer (.+) \<.+\> (\d+)( [+-]\d+)/)
                                            commit.committer = committer
                                            commit.committerTimestamp = Number (timestamp)
                                        } catch (e) {
                                            log.bright.red.error ('Failed to parse:', line)
                                            throw e
                                        }
                                    }
                                    else if (line.startsWith ('    ')) commit.message.push (line.trim ())
                                    return commit
                                }, { message: [] })
                    )
                .filter (c => c.hash)
                .map (c => ({ ...c,
                    message: c.message.filter (s => s).join ('\n'),
                    timestamp: Math.max (c.authorTimestamp || 0, c.committerTimestamp || 0) + 1
                }))
            }

/*  ------------------------------------------------------------------------ */

    const sleep = ms => new Promise (resolve => setTimeout (resolve, ms))

/*  ------------------------------------------------------------------------ */

    async function* newCommits (repo) {

        const { dir } = repo

        log.cyan ('Watching for new commits in', dir.bright, 'starting from', (repo.since || 'now').bright)

        while (true /* this is OK due to the asynchronous nature of this function */) {

            const opts = repo.since ? `--since "${repo.since}"` : '-1'
                , cmd = `cd ${dir.replace (/^\\\s/g, '\\ ')} && git fetch && git rev-list --topo-order --header --reverse --all ${opts}`
                , commits = parseGitLog (await exec (cmd))

            if (commits.length) {
                log (`new commits since ${repo.since}, fetched with ${cmd}`)
                if (repo.since) { // DO NOT report if launched first time
                    for (const commit of commits) yield commit
                }
                repo.since = commits[commits.length - 1].timestamp
                saveConfig ()
            }

            await sleep (config.fetchFrequency)
        }
    }

/*  ------------------------------------------------------------------------ */

    const triggerJob = () => {
        const host = config.url
            , port = config.port
            , path = 'job/restart_tracker/build'
            , args = require ('querystring').stringify ({ token: config.accessToken })
            , auth = config.username + ":" + config.password
            , method = 'GET'
            , options = { host, port, auth, path: `http://${host}:${port}/${path}?${args}`, }

        if (testMode) log.yellow ({ options })
        return http.get (options)
    }

/*  ------------------------------------------------------------------------ */

    const shouldTrigger = ({ message }) => message.match (new RegExp (config.messagePattern))

/*  ------------------------------------------------------------------------ */

    async function watch (repo) {

        const { name, dir, channel = 'general', since = '' } = repo

        for await (let commit of newCommits (repo)) {

            if (shouldTrigger (commit)) { // filters out automatically generated garbage and other non-informative stuff

                log.bright.green (commit, '\n')

                if (!testMode) {

                    await triggerJob ()

                }

            } else {

                log.dim.green (commit, '\n')

            }
        }
    };

/*  ------------------------------------------------------------------------ */

    config.repos.forEach (repo => watch (repo).catch (fatal))
    // ;(async () => await triggerJob ()) ()

/*  ------------------------------------------------------------------------ */
