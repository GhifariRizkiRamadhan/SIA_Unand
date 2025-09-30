const showLogin = require("./ruter")
const showForgot = require("./ruter")
const showWait = require("./ruter")
const showReset = require("./ruter")
const showDshMhs = require("./ruter")
const showDshPnl = require("./ruter")
const showPembayaran = require("./ruter")
const showBebasAsrama = require("./ruter")
const showBebasAsramaPengelola = require("./ruter")
const showDtPenghuni = require("./ruter")
const ajukanBebasAsrama = require("./ruter")
const getDetailPembayaran = require("./ruter")
const getAllBebasAsrama = require("./ruter")
const getDetailBebasAsrama = require("./ruter")
const getStatusBebasAsrama = require("./ruter")
const getTagihanMahasiswa = require("./ruter")
const getAllPembayaran = require("./ruter")
const approvePembayaran = require("./ruter")
const uploadBuktiPembayaran = require("./ruter")
const deleteBebasAsrama = require("./ruter") 
const rejectPembayaran = require("./ruter") 
const verifikasiFasilitas = require("./ruter")  
const getBuktiPembayaran = require("./ruter")
const reuploadBuktiPembayaran = require("./ruter")

const server = {}


server.showLogin = showLogin
server.showForgot = showForgot
server.showWait = showWait
server.showReset = showReset
server.showDshMhs = showDshMhs
server.showDshPnl = showDshPnl
server.showPembayaran = showPembayaran
server.showBebasAsrama = showBebasAsrama
server.showBebasAsramaPengelola = showBebasAsramaPengelola
server.showDtPenghuni = showDtPenghuni
server.ajukanBebasAsrama = ajukanBebasAsrama
server.getDetailPembayaran = getDetailPembayaran
server.getAllBebasAsrama = getAllBebasAsrama
server.getDetailBebasAsrama = getDetailBebasAsrama
server.getStatusBebasAsrama = getStatusBebasAsrama
server.getTagihanMahasiswa = getTagihanMahasiswa
server.getAllPembayaran = getAllPembayaran
server.approvePembayaran = approvePembayaran
server.uploadBuktiPembayaran = uploadBuktiPembayaran
server.deleteBebasAsrama = deleteBebasAsrama
server.rejectPembayaran = rejectPembayaran
server.verifikasiFasilitas = verifikasiFasilitas
server.getBuktiPembayaran = getBuktiPembayaran
server.reuploadBuktiPembayaran = reuploadBuktiPembayaran


module.exports = server