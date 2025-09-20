const showLogin = require("./ruter")
const showForgot = require("./ruter")
const showWait = require("./ruter")
const showReset = require("./ruter")
const showDshMhs = require("./ruter")
const showDshPnl = require("./ruter")
const showPembayaran = require("./ruter")
const showBebasAsrama = require("./ruter")
const server = {}

server.showLogin = showLogin
server.showForgot = showForgot
server.showWait = showWait
server.showReset = showReset
server.showDshMhs = showDshMhs
server.showDshPnl = showDshPnl
server.showPembayaran = showPembayaran
server.showBebasAsrama = showBebasAsrama

module.exports = server