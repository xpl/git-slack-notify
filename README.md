# git-slack-notify

![pic](https://cdn.jpg.wtf/futurico/a6/39/1495803414-a6396ced47686e423007d19d48c00062.png)

- [x] Watches for new commits in Git repositories using `git fetch && git log --all`
- [x] Reports them to Slack channels
- [x] Written in JavaScript — [your grandmother can easily read it](https://github.com/xpl/git-slack-notify/blob/master/git-slack-notify.js)

## Install

```bash
git clone http://github.com/xpl/git-slack-notify
cd git-slack-notify
npm install
```

## Running

```bash
npm start
```

## Configure

Default config is at [`config.json`](https://github.com/xpl/git-slack-notify/blob/master/config.json). Running with other file:

```bash
npm start myconfig.json
```

```javascript
{    "accessToken":   "<your Slack OAuth access token here>",
  "fetchFrequency":    30000,
           "repos": [ {              "name": "git-slack-notify",
                                      "dir": "./",
                                  "channel": "general",
                        "lastTopCommitHash": ""                  } ] }
```

It is auto-updated (with formatting) when new commits arrive and `lastTopCommitHash` changes.