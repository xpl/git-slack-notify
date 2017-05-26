# git-slack-notify

![pic](https://cdn.jpg.wtf/futurico/a6/39/1495803414-a6396ced47686e423007d19d48c00062.png)

## WTF

- Watches for new commits in Git repositories using `git fetch && git log --all`
- Reports them to Slack channels
- Written in JavaScript — [your grandmother can easily read it](https://github.com/xpl/git-slack-notify/blob/master/git-slack-notify.js)

## Install

```bash
git clone http://github.com/xpl/git-slack-notify
cd git-slack-notify
npm install
```

## Configure

Edit [`config.js`](https://github.com/xpl/git-slack-notify/blob/master/config.js):

```javascript
module.exports = {

    accessToken: '<your Slack OAuth access token here>',

    fetchFrequency: 30000, // check for new commits each 30s

    repos: [
        {
            name: 'My Cool Project',                // display name
            dir: '/usr/local/my cool project',      // local Git repo directory
            channel: 'general'                      // where to post
        }
    ]
}
```

## Run

```bash
npm start
```
