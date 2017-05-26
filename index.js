require ('babel-polyfill') 
require ('babel-register') ({}) // replaces default 'require' implementation with ES7-transpiling one 

require ('./git-slack-notify.js')