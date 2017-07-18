# git-slack-notify

![pic](https://cdn.jpg.wtf/futurico/a6/39/1495803414-a6396ced47686e423007d19d48c00062.png)

- [x] Tracks new commits in multiple local Git repositories using `git fetch && git log --all`
- [x] Reports them to Slack channels
- [x] Written in JavaScript — [your grandmother can easily read it](https://github.com/xpl/git-slack-notify/blob/master/git-slack-notify.js)

## Features

- [x] Super-easy no-brain installation
- [x] Filters automatically generated commits (NPM version numbers, online `README.md` editing, etc)

## TODO

- [ ] Automated tests

## Install

You will need [NPM](https://www.npmjs.com/get-npm).

```bash
git clone http://github.com/xpl/git-slack-notify
cd git-slack-notify
npm install
```

## Run

```bash
npm start
```

## Configure

Default config name will be `config.json`. Running with other file:

```bash
npm start myconfig.json
```

If not found, it will be auto-generated with example data:

```
{
    accessToken: '<your Slack OAuth access token here>',

    fetchFrequency: 30000, // check for new commits each 30s

    repos: [                                    // you can track multiple repositories
        {
            name: 'Git Slack Notify',           // display name (optional, if not set, will be generated from `dir`)
            dir: process.cwd (),                // local git repo path
            channel: 'general',                 // where to post
            lastTopCommitHash: ''               // this is auto-updated when new commits arrive
        }
    ]
}
```

## Obtaining `accessToken`

1. Create a new Slack App at [https://api.slack.com/apps](https://api.slack.com/apps)
2. Activate the _"Incoming webhooks"_ feature
3. Click on _"Install app to your team"_ (will generate the token)
4. Under _"OAuth & Permissions"_, grab your _"OAuth Access Token"_
