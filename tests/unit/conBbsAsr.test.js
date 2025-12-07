// ==========================================================
// FILE: tests/unit/conBbsAsr.test.js
// ==========================================================

const mockPrismaMahasiswaFindUnique = jest.fn();
const mockPrismaPengelolaFindMany = jest.fn();
const mockPrismaSuratFindFirst = jest.fn();
const mockPrismaSuratCreate = jest.fn();
const mockPrismaSuratFindUnique = jest.fn();
const mockPrismaSuratDelete = jest.fn();
const mockPrismaSuratFindMany = jest.fn();
const mockPrismaPembayaranFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
    PrismaClient: jest.fn().mockImplementation(() => ({
        mahasiswa: {
            findUnique: mockPrismaMahasiswaFindUnique,
        },
        pengelolaasrama: {
            findMany: mockPrismaPengelolaFindMany,
        },
        suratbebasasrama: {
            findFirst: mockPrismaSuratFindFirst,
            create: mockPrismaSuratCreate,
            findUnique: mockPrismaSuratFindUnique,
            delete: mockPrismaSuratDelete,
            findMany: mockPrismaSuratFindMany,
        },
        pembayaran: {
            findMany: mockPrismaPembayaranFindMany,
        }
    })),
}));

const controller = require('../../controller/conBbsAsr');
const User = require('../../models/userModels');
const notificationController = require('../../controller/notification');
const ejs = require('ejs');
const PDFDocument = require('pdfkit');

jest.mock('../../models/userModels');
jest.mock('../../controller/notification', () => ({
    createNotification: jest.fn().mockResolvedValue({}),
}));
jest.mock('ejs');
jest.mock('pdfkit');

global.io = { to: jest.fn().mockReturnThis(), emit: jest.fn() };

describe('Unit Test: controller/conBbsAsr.js', () => {
    let mockRequest, mockResponse;
    let pdfMock;

    const mockMahasiswa = { mahasiswa_id: 1, kipk: 'tidak', nim: '12345', user: { user_id: 'u1', name: 'Test' } };
    const mockPengajuan = { Surat_id: 1, status_pengajuan: 'VERIFIKASI_FASILITAS', total_biaya: 2000000 };

    beforeEach(() => {
        jest.clearAllMocks();

        mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
        mockPrismaPengelolaFindMany.mockResolvedValue([{ user_id: 'p1' }]);
        mockPrismaSuratFindFirst.mockResolvedValue(null);
        mockPrismaSuratCreate.mockResolvedValue(mockPengajuan);
        mockPrismaSuratFindUnique.mockResolvedValue(mockPengajuan);
        mockPrismaSuratDelete.mockResolvedValue({ count: 1 });
        mockPrismaSuratFindMany.mockResolvedValue([{ id: 1 }]);
        mockPrismaPembayaranFindMany.mockResolvedValue([{ id: 1 }]);

        User.findById.mockResolvedValue({ name: 'User', role: 'mahasiswa' });

        ejs.renderFile.mockResolvedValue('<html></html>');

        // Setup PDF Mock
        pdfMock = {
            font: jest.fn().mockReturnThis(),
            fontSize: jest.fn().mockReturnThis(),
            text: jest.fn().mockReturnThis(),
            moveDown: jest.fn().mockReturnThis(),
            image: jest.fn().mockReturnThis(),
            pipe: jest.fn(),
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
            pipe: jest.fn(),
            sendFile: jest.fn()
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
        expect(mockPrismaSuratCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total_biaya: 2000000 }) }));
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('ajukanBebasAsrama: Happy KIPK', async () => {
        mockPrismaMahasiswaFindUnique.mockResolvedValue({ ...mockMahasiswa, kipk: 'ya' });
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(mockPrismaSuratCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ total_biaya: 0 }) }));
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
        mockPrismaSuratFindFirst.mockResolvedValue({ id: 1 });
        await controller.ajukanBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(409);
    });

    it('ajukanBebasAsrama: Error', async () => {
        mockPrismaSuratCreate.mockRejectedValue(new Error('DB Fail'));
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
        mockPrismaSuratFindUnique.mockResolvedValue(null);
        await controller.getStatusBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('getStatusBebasAsrama: Invalid ID', async () => {
        mockRequest.params.id = 'abc';
        await controller.getStatusBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('getStatusBebasAsrama: Error', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindUnique.mockRejectedValue(new Error('DB Fail'));
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
        mockPrismaSuratFindUnique.mockResolvedValue(null);
        await controller.deleteBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('deleteBebasAsrama: Invalid ID', async () => {
        mockRequest.params.id = 'abc';
        await controller.deleteBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('deleteBebasAsrama: Error', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindUnique.mockRejectedValue(new Error('DB Fail'));
        await controller.deleteBebasAsrama(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Download ---
    it('downloadSurat: Happy', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindUnique.mockResolvedValue({
            ...mockPengajuan,
            mahasiswa: { nim: '12345', nama: 'Test', jurusan: 'SI' }
        });
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
        mockRequest.params.id = '1';
        mockPrismaSuratFindUnique.mockResolvedValue(null);
        await controller.downloadSurat(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('downloadSurat: Invalid ID', async () => {
        mockRequest.params.id = 'abc';
        await controller.downloadSurat(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('downloadSurat: Error', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindUnique.mockRejectedValue(new Error('DB Fail'));
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
        mockRequest.params.id = '1';
        mockPrismaPembayaranFindMany.mockResolvedValue([]);
        await controller.getTagihanMahasiswa(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(404);
    });

    it('getTagihanMahasiswa: Invalid ID', async () => {
        mockRequest.params.id = 'abc';
        await controller.getTagihanMahasiswa(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('getTagihanMahasiswa: Error', async () => {
        mockRequest.params.id = '1';
        mockPrismaPembayaranFindMany.mockRejectedValue(new Error('DB Fail'));
        await controller.getTagihanMahasiswa(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Get Riwayat ---
    it('getRiwayatPengajuan: Happy', async () => {
        mockRequest.params.id = '1';
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });

    it('getRiwayatPengajuan: Happy (Null Data)', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindMany.mockResolvedValue(null);
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, data: [] });
    });

    it('getRiwayatPengajuan: Invalid ID', async () => {
        mockRequest.params.id = 'abc';
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('getRiwayatPengajuan: Error', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindMany.mockRejectedValue(new Error('DB Fail'));
        await controller.getRiwayatPengajuan(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });

    // --- Check Active ---
    it('checkActiveSubmission: Active', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindFirst.mockResolvedValue({ id: 1 });
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ hasActive: true }));
    });

    it('checkActiveSubmission: Inactive', async () => {
        mockRequest.params.id = '1';
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.json).toHaveBeenCalledWith({ hasActive: false });
    });

    it('checkActiveSubmission: Invalid ID', async () => {
        mockRequest.params.id = 'abc';
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });

    it('checkActiveSubmission: Error', async () => {
        mockRequest.params.id = '1';
        mockPrismaSuratFindFirst.mockRejectedValue(new Error('DB Fail'));
        await controller.checkActiveSubmission(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
});