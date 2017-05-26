module.exports = {

    accessToken: '<your Slack OAuth access token here>',

    fetchFrequency: 30000, // check for new commits each 30s

    repos: [

    /*  Example repository  */
    
        {
            name: 'git-slack-notify', // display name
            dir: process.cwd (),      // repo directory
            channel: 'general'        // channel to post notifications
        }
    ]
}