const showLogin = require("./ruter")
const showForgot = require("./ruter")
const showWait = require("./ruter")
const showReset = require("./ruter")
const showDshMhs = require("./ruter")
const showDshPnl = require("./ruter")
const server = {}

server.showLogin = showLogin
server.showForgot = showForgot
server.showWait = showWait
server.showReset = showReset
server.showDshMhs = showDshMhs
server.showDshPnl = showDshPnl

module.exports = server