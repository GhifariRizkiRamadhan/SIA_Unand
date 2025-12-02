// ==========================================================
// FILE: tests/unit/conBbsAsr.test.js (FIXED PDF PIPE)
// ==========================================================

const mockPrismaMahasiswaFindUnique = jest.fn();
const mockPrismaPengelolaFindMany = jest.fn();
const mockPrismaMahasiswaFindFirst = jest.fn();
const mockPrismaPengelolaFindFirst = jest.fn();

jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        mahasiswa: {
            findUnique: mockPrismaMahasiswaFindUnique,
            findFirst: mockPrismaMahasiswaFindFirst,
        },
        pengelolaasrama: {
            findMany: mockPrismaPengelolaFindMany,
            findFirst: mockPrismaPengelolaFindFirst,
        },
    })),
}));

const controller = require('../../controller/conBbsAsr');
const User = require('../../models/userModels');
const BebasAsrama = require('../../models/bebasAsramaModel');
const Pembayaran = require('../../models/pembayaranModel');
const notificationController = require('../../controller/notification');
const ejs = require('ejs');
const PDFDocument = require('pdfkit');

jest.mock('../../models/userModels');
jest.mock('../../models/bebasAsramaModel');
jest.mock('../../models/pembayaranModel');
jest.mock('../../controller/notification', () => ({
    createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('ejs');
jest.mock('pdfkit');

global.io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

describe('Unit Test: controller/conBbsAsr.js', () => {
    let mockRequest, mockResponse;
    let pdfMock; // Variabel untuk menyimpan instance mock PDF

    const mockMahasiswa = { mahasiswa_id: 1, kipk: 'tidak', nim: '12345', user: { user_id: 'u1', name: 'Test' } };
    const mockPengajuan = { Surat_id: 1, status_pengajuan: 'VERIFIKASI_FASILITAS', total_biaya: 2000000 };

    beforeEach(() => {
        jest.clearAllMocks();

        mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
        mockPrismaPengelolaFindMany.mockResolvedValue([{ user_id: 'p1' }]);

        User.findById.mockResolvedValue({ name: 'User', role: 'mahasiswa' });

        BebasAsrama.findActiveByMahasiswaId.mockResolvedValue(null);
        BebasAsrama.create.mockResolvedValue(mockPengajuan);
        BebasAsrama.findById.mockResolvedValue(mockPengajuan);
        BebasAsrama.findByIdAndDelete.mockResolvedValue({ count: 1 });
        BebasAsrama.findByIdWithMahasiswa.mockResolvedValue({
            ...mockPengajuan,
            mahasiswa: { nim: '12345', nama: 'Test', jurusan: 'SI' }
        });
        BebasAsrama.findByMahasiswaId.mockResolvedValue([{ id: 1 }]);

        Pembayaran.findByMahasiswaId.mockResolvedValue([{ id: 1 }]);

        ejs.renderFile.mockResolvedValue('<html></html>');

        // Setup PDF Mock
        pdfMock = {
            font: jest.fn().mockReturnThis(),
            fontSize: jest.fn().mockReturnThis(),
            text: jest.fn().mockReturnThis(),
            moveDown: jest.fn().mockReturnThis(),
            image: jest.fn().mockReturnThis(),
            pipe: jest.fn(), // Ini yang kita cek nanti
            end: jest.fn(),
            page: { width: 100, margins: { right: 10 } },
            y: 10
        };
        PDFDocument.mockImplementation(() => pdfMock);

        mockRequest = { user: { user_id: 'u1', mahasiswa_id: 1 }, params: {}, body: {}, session: {} };
        mockResponse = {
            render: jest.fn(),
            redirect: jest.fn(),
            json: jest.fn(),
            status: jest.fn(() => mockResponse),
            setHeader: jest.fn(),
            pipe: jest.fn()
        };
    });

    // --- Show ---
    it('showBebasAsrama: Happy Path', async () => {
        await controller.showBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.render).toHaveBeenCalledWith('layouts/main', expect.anything());
    });

    it('showBebasAsrama: No User', async () => {
        mockRequest.user = null;
        await controller.showBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.redirect).toHaveBeenCalledWith('/login');
    });

    it('showBebasAsrama: Error', async () => {
        User.findById.mockRejectedValue(new Error('DB Fail'));
        await controller.showBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Ajukan ---
    it('ajukanBebasAsrama: Happy Non-KIPK', async () => {
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(BebasAsrama.create).toHaveBeenCalledWith(expect.objectContaining({ total_biaya: 2000000 }));
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('ajukanBebasAsrama: Happy KIPK', async () => {
        mockPrismaMahasiswaFindUnique.mockResolvedValue({ ...mockMahasiswa, kipk: 'ya' });
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(BebasAsrama.create).toHaveBeenCalledWith(expect.objectContaining({ total_biaya: 0 }));
    });

    it('ajukanBebasAsrama: Forbidden', async () => {
        mockRequest.user.mahasiswa_id = null;
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    it('ajukanBebasAsrama: Mahasiswa Not Found', async () => {
        mockPrismaMahasiswaFindUnique.mockResolvedValue(null);
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('ajukanBebasAsrama: Conflict', async () => {
        BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ id: 1 });
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('ajukanBebasAsrama: Error', async () => {
        BebasAsrama.create.mockRejectedValue(new Error('DB Fail'));
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Get Status ---
    it('getStatusBebasAsrama: Happy', async () => {
        mockRequest.params.id = '1';
        await controller.getStatusBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('getStatusBebasAsrama: Not Found', async () => {
        mockRequest.params.id = '99';
        BebasAsrama.findById.mockResolvedValue(null);
        await controller.getStatusBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('getStatusBebasAsrama: Error', async () => {
        BebasAsrama.findById.mockRejectedValue(new Error('DB Fail'));
        await controller.getStatusBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Delete ---
    it('deleteBebasAsrama: Happy', async () => {
        mockRequest.params.id = '1';
        await controller.deleteBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('deleteBebasAsrama: Not Found (Mock Find)', async () => {
        mockRequest.params.id = '99';
        BebasAsrama.findById.mockResolvedValue(null);
        await controller.deleteBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('deleteBebasAsrama: Error', async () => {
        BebasAsrama.findById.mockRejectedValue(new Error('DB Fail'));
        await controller.deleteBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Download ---
    it('downloadSurat: Happy', async () => {
        mockRequest.params.id = '1';
        await controller.downloadSurat(mockRequest, mockResponse);
        expect(mockResponse.setHeader).toHaveBeenCalled();
        expect(pdfMock.pipe).toHaveBeenCalledWith(mockResponse);

        // Verify PDF content
        expect(pdfMock.text).toHaveBeenCalledWith(expect.stringContaining('SURAT KETERANGAN BEBAS ASRAMA'), expect.anything());
        expect(pdfMock.text).toHaveBeenCalledWith(expect.stringContaining('12345'), expect.anything()); // NIM
        expect(pdfMock.text).toHaveBeenCalledWith(expect.stringContaining('Test'), expect.anything()); // Name
        expect(pdfMock.text).toHaveBeenCalledWith(expect.stringContaining('SI'), expect.anything()); // Jurusan
    });

    it('downloadSurat: Not Found', async () => {
        BebasAsrama.findByIdWithMahasiswa.mockResolvedValue(null);
        await controller.downloadSurat(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('downloadSurat: Error', async () => {
        BebasAsrama.findByIdWithMahasiswa.mockRejectedValue(new Error('DB Fail'));
        await controller.downloadSurat(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Get Tagihan ---
    it('getTagihanMahasiswa: Happy', async () => {
        mockRequest.params.id = '1';
        await controller.getTagihanMahasiswa(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('getTagihanMahasiswa: Empty', async () => {
        Pembayaran.findByMahasiswaId.mockResolvedValue([]);
        await controller.getTagihanMahasiswa(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('getTagihanMahasiswa: Error', async () => {
        Pembayaran.findByMahasiswaId.mockRejectedValue(new Error('DB Fail'));
        await controller.getTagihanMahasiswa(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Get Riwayat ---
    it('getRiwayatPengajuan: Happy', async () => {
        mockRequest.params.id = '1';
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('getRiwayatPengajuan: Empty (Null Data)', async () => {
        mockRequest.params.id = '1';
        BebasAsrama.findByMahasiswaId.mockResolvedValue(null);
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('getRiwayatPengajuan: Error', async () => {
        BebasAsrama.findByMahasiswaId.mockRejectedValue(new Error('DB Fail'));
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Check Active ---
    it('checkActiveSubmission: Active', async () => {
        BebasAsrama.findActiveByMahasiswaId.mockResolvedValue({ id: 1 });
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ hasActive: true }));
    });

    it('checkActiveSubmission: Inactive', async () => {
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith({ hasActive: false });
    });

    it('checkActiveSubmission: Error', async () => {
        BebasAsrama.findActiveByMahasiswaId.mockRejectedValue(new Error('DB Fail'));
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
});