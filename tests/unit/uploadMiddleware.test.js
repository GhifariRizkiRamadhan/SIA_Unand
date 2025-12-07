const multer = require('multer');
const fs = require('fs');
const path = require('path');

// Mock fs
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn()
}));

// Mock Multer
jest.mock('multer', () => {
    const multerMock = jest.fn(() => ({
        any: jest.fn(),
        single: jest.fn(),
    }));
    multerMock.diskStorage = jest.fn(() => 'mockStorage');
    multerMock.MulterError = class MulterError extends Error {
        constructor(code) {
            super(code);
            this.code = code;
        }
    };
    return multerMock;
});

describe('Middleware: uploadMiddleware', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;
    let uploadMiddleware;

    // Captured configurations
    let pelaporanStorageConfig;
    let pelaporanFilter;
    let izinStorageConfig;
    let izinFilter;
    let buktiStorageConfig;
    let buktiFilter;
    let archiveStorageConfig;
    let archiveFilter;
    let imageStorageConfig;
    let imageFilter;

    beforeAll(() => {
        // Require the module to trigger top-level execution and mock capturing
        jest.isolateModules(() => {
            uploadMiddleware = require('../../middlewares/uploadMiddleware');
        });

        const diskStorageCalls = multer.diskStorage.mock.calls;
        const multerCalls = multer.mock.calls;

        // --- Capture Pelaporan Configs ---
        const pelaporanCall = diskStorageCalls.find(call => {
            const config = call[0];
            let isMatch = false;
            config.destination({}, {}, (err, dest) => {
                if (dest === 'public/uploads/pelaporan') isMatch = true;
            });
            return isMatch;
        });
        if (pelaporanCall) pelaporanStorageConfig = pelaporanCall[0];

        const pelaporanCandidateCalls = multerCalls.filter(call => {
            const config = call[0];
            return config.limits && config.limits.fileSize === 5 * 1024 * 1024 && config.limits.files === 1;
        });

        const pelaporanCandidate = pelaporanCandidateCalls.find(call => {
            const filter = call[0].fileFilter;
            let isPelaporan = false;
            const cb = (err, result) => {
                if (err) isPelaporan = true;
            };
            filter({}, { originalname: 'test.gif', mimetype: 'image/gif' }, cb);
            return isPelaporan;
        });
        if (pelaporanCandidate) pelaporanFilter = pelaporanCandidate[0].fileFilter;

        // --- Capture Izin Configs ---
        const izinCall = diskStorageCalls.find(call => {
            const config = call[0];
            let isMatch = false;
            config.destination({}, {}, (err, dest) => {
                if (dest === 'public/uploads/izin') isMatch = true;
            });
            return isMatch;
        });
        if (izinCall) izinStorageConfig = izinCall[0];

        const izinMulterCall = multerCalls.find(call => {
            const config = call[0];
            return config.limits && config.limits.fileSize === 10 * 1024 * 1024 && config.limits.files === 1;
        });
        if (izinMulterCall) izinFilter = izinMulterCall[0].fileFilter;

        // --- Capture Bukti Configs ---
        const buktiCall = diskStorageCalls.find(call => {
            const config = call[0];
            let isMatch = false;
            config.destination({}, {}, (err, dest) => {
                if (dest === 'uploads/bukti') isMatch = true;
            });
            return isMatch;
        });
        if (buktiCall) buktiStorageConfig = buktiCall[0];

        const buktiMulterCall = multerCalls.find(call => {
            const config = call[0];
            return config.limits && config.limits.fileSize === 5 * 1024 * 1024 && !config.limits.files;
        });
        if (buktiMulterCall) buktiFilter = buktiMulterCall[0].fileFilter;

        // --- Capture Archive Configs ---
        const archiveCall = diskStorageCalls.find(call => {
            const config = call[0];
            let isMatch = false;
            config.destination({}, {}, (err, dest) => {
                if (dest === 'uploads/') isMatch = true;
            });
            return isMatch;
        });
        if (archiveCall) archiveStorageConfig = archiveCall[0];

        const archiveMulterCall = multerCalls.find(call => {
            const config = call[0];
            return config.limits && config.limits.fileSize === 50 * 1024 * 1024;
        });
        if (archiveMulterCall) archiveFilter = archiveMulterCall[0].fileFilter;

        // --- Capture Image Configs (Pemberitahuan) ---
        const imageCall = diskStorageCalls.find(call => {
            const config = call[0];
            let isMatch = false;
            config.destination({}, {}, (err, dest) => {
                if (dest === 'public/uploads/pemberitahuan') isMatch = true;
            });
            return isMatch;
        });
        if (imageCall) imageStorageConfig = imageCall[0];

        const imageCandidate = pelaporanCandidateCalls.find(call => {
            const filter = call[0].fileFilter;
            let isImage = false;
            const cb = (err, result) => {
                if (result === true) isImage = true;
            };
            filter({}, { originalname: 'test.gif', mimetype: 'image/gif' }, cb);
            return isImage;
        });
        if (imageCandidate) imageFilter = imageCandidate[0].fileFilter;
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockRequest = {};
        mockResponse = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        nextFunction = jest.fn();
    });

    // --- Internal Logic Testing (Storage & Filters) ---
    describe('Internal Logic: Pelaporan', () => {
        it('should have correct destination logic for pelaporan', () => {
            expect(pelaporanStorageConfig).toBeDefined();
            const destCb = jest.fn();
            pelaporanStorageConfig.destination({}, {}, destCb);

            expect(fs.existsSync).toHaveBeenCalledWith('public/uploads/pelaporan');
            expect(destCb).toHaveBeenCalledWith(null, 'public/uploads/pelaporan');
        });

        it('should create directory if not exists', () => {
            fs.existsSync.mockReturnValue(false);
            const destCb = jest.fn();
            pelaporanStorageConfig.destination({}, {}, destCb);
            expect(fs.mkdirSync).toHaveBeenCalledWith('public/uploads/pelaporan', { recursive: true });
        });

        it('should NOT create directory if it already exists (Line 7)', () => {
            fs.existsSync.mockReturnValue(true); // Directory exists
            const destCb = jest.fn();
            pelaporanStorageConfig.destination({}, {}, destCb);
            expect(fs.mkdirSync).not.toHaveBeenCalled(); // Line 8 should be skipped
        });

        it('should have correct filename logic for pelaporan', () => {
            expect(pelaporanStorageConfig).toBeDefined();
            const file = { originalname: 'Test File!.jpg' };
            const filenameCb = jest.fn();

            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
            jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

            pelaporanStorageConfig.filename({}, file, filenameCb);

            const expectedName = expect.stringMatching(/Test_File_-\d+-\d+\.jpg/);
            expect(filenameCb).toHaveBeenCalledWith(null, expectedName);

            jest.restoreAllMocks();
        });

        it('should accept valid image files (JPG/PNG)', () => {
            expect(pelaporanFilter).toBeDefined();
            const cb = jest.fn();

            pelaporanFilter({}, { originalname: 'test.jpg', mimetype: 'image/jpeg' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);

            pelaporanFilter({}, { originalname: 'test.png', mimetype: 'image/png' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should reject invalid file types', () => {
            expect(pelaporanFilter).toBeDefined();
            const cb = jest.fn();

            pelaporanFilter({}, { originalname: 'test.pdf', mimetype: 'application/pdf' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toContain('Only JPG/PNG images are allowed');

            cb.mockClear();
            pelaporanFilter({}, { originalname: 'test.jpg', mimetype: 'application/pdf' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    // --- Internal Logic: Izin Keluar ---
    describe('Internal Logic: Izin Keluar', () => {
        it('should have correct destination logic for izin', () => {
            expect(izinStorageConfig).toBeDefined();
            const destCb = jest.fn();
            izinStorageConfig.destination({}, {}, destCb);

            expect(fs.existsSync).toHaveBeenCalledWith('public/uploads/izin');
            expect(destCb).toHaveBeenCalledWith(null, 'public/uploads/izin');
        });

        it('should create directory if not exists', () => {
            fs.existsSync.mockReturnValue(false);
            const destCb = jest.fn();
            izinStorageConfig.destination({}, {}, destCb);
            expect(fs.mkdirSync).toHaveBeenCalledWith('public/uploads/izin', { recursive: true });
        });

        it('should have correct filename logic for izin', () => {
            expect(izinStorageConfig).toBeDefined();
            const file = { originalname: 'My Doc.pdf' };
            const filenameCb = jest.fn();

            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
            jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

            izinStorageConfig.filename({}, file, filenameCb);

            const expectedName = expect.stringMatching(/My_Doc-\d+-\d+\.pdf/);
            expect(filenameCb).toHaveBeenCalledWith(null, expectedName);

            jest.restoreAllMocks();
        });

        it('should accept valid document files (PDF/DOC/DOCX)', () => {
            expect(izinFilter).toBeDefined();
            const cb = jest.fn();

            izinFilter({}, { originalname: 'test.pdf', mimetype: 'application/pdf' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);

            izinFilter({}, { originalname: 'test.doc', mimetype: 'application/msword' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);

            izinFilter({}, { originalname: 'test.docx', mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should reject invalid file types', () => {
            expect(izinFilter).toBeDefined();
            const cb = jest.fn();

            izinFilter({}, { originalname: 'test.jpg', mimetype: 'image/jpeg' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toContain('Only PDF/DOC/DOCX files are allowed');

            cb.mockClear();
            izinFilter({}, { originalname: 'test.pdf', mimetype: 'image/jpeg' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    // --- Internal Logic: Bukti Pembayaran ---
    describe('Internal Logic: Bukti Pembayaran', () => {
        it('should have correct destination logic for bukti', () => {
            expect(buktiStorageConfig).toBeDefined();
            const destCb = jest.fn();
            buktiStorageConfig.destination({}, {}, destCb);

            expect(fs.existsSync).toHaveBeenCalledWith('uploads/bukti');
            expect(destCb).toHaveBeenCalledWith(null, 'uploads/bukti');
        });

        it('should create directory if not exists', () => {
            fs.existsSync.mockReturnValue(false);
            const destCb = jest.fn();
            buktiStorageConfig.destination({}, {}, destCb);
            expect(fs.mkdirSync).toHaveBeenCalledWith('uploads/bukti', { recursive: true });
        });

        it('should have correct filename logic for bukti', () => {
            expect(buktiStorageConfig).toBeDefined();
            const file = { originalname: 'Bukti Bayar.jpg' };
            const filenameCb = jest.fn();

            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
            jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

            buktiStorageConfig.filename({}, file, filenameCb);

            const expectedName = expect.stringMatching(/Bukti_Bayar-\d+-\d+\.jpg/);
            expect(filenameCb).toHaveBeenCalledWith(null, expectedName);

            jest.restoreAllMocks();
        });

        it('should accept valid image files (JPG/PNG)', () => {
            expect(buktiFilter).toBeDefined();
            const cb = jest.fn();

            buktiFilter({}, { originalname: 'test.jpg', mimetype: 'image/jpeg' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);

            buktiFilter({}, { originalname: 'test.png', mimetype: 'image/png' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should reject invalid file types', () => {
            expect(buktiFilter).toBeDefined();
            const cb = jest.fn();

            // Wrong extension
            buktiFilter({}, { originalname: 'test.pdf', mimetype: 'application/pdf' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toContain('Only JPG and PNG images are allowed');

            // Wrong mimetype
            cb.mockClear();
            buktiFilter({}, { originalname: 'test.jpg', mimetype: 'application/pdf' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    // --- Internal Logic: Archive Upload ---
    describe('Internal Logic: Archive Upload', () => {
        it('should have correct destination logic for archive', () => {
            expect(archiveStorageConfig).toBeDefined();
            const destCb = jest.fn();
            archiveStorageConfig.destination({}, {}, destCb);

            expect(fs.existsSync).toHaveBeenCalledWith('uploads/');
            expect(destCb).toHaveBeenCalledWith(null, 'uploads/');
        });

        it('should create directory if not exists', () => {
            fs.existsSync.mockReturnValue(false);
            const destCb = jest.fn();
            archiveStorageConfig.destination({}, {}, destCb);
            expect(fs.mkdirSync).toHaveBeenCalledWith('uploads/', { recursive: true });
        });

        it('should have correct filename logic for archive', () => {
            expect(archiveStorageConfig).toBeDefined();
            const file = { originalname: 'Archive.zip' };
            const filenameCb = jest.fn();

            jest.spyOn(Date, 'now').mockReturnValue(1234567890);

            archiveStorageConfig.filename({}, file, filenameCb);

            // Expected: 1234567890-Archive.zip (sanitized)
            // Code: `${Date.now()}-${sanitizedName}`
            const expectedName = '1234567890-Archive.zip';
            expect(filenameCb).toHaveBeenCalledWith(null, expectedName);

            jest.restoreAllMocks();
        });

        it('should accept valid archive files (ZIP/RAR/TAR/7Z)', () => {
            expect(archiveFilter).toBeDefined();
            const cb = jest.fn();

            archiveFilter({}, { originalname: 'test.zip', mimetype: 'application/zip' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);

            archiveFilter({}, { originalname: 'test.rar', mimetype: 'application/x-rar-compressed' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should reject invalid file types', () => {
            expect(archiveFilter).toBeDefined();
            const cb = jest.fn();

            archiveFilter({}, { originalname: 'test.jpg', mimetype: 'image/jpeg' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
            expect(cb.mock.calls[0][0].message).toContain('Only archives are allowed');
        });
    });

    // --- Internal Logic: Image Upload (Pemberitahuan) ---
    describe('Internal Logic: Image Upload (Pemberitahuan)', () => {
        it('should have correct destination logic for image', () => {
            expect(imageStorageConfig).toBeDefined();
            const destCb = jest.fn();
            imageStorageConfig.destination({}, {}, destCb);

            expect(fs.existsSync).toHaveBeenCalledWith('public/uploads/pemberitahuan');
            expect(destCb).toHaveBeenCalledWith(null, 'public/uploads/pemberitahuan');
        });

        it('should create directory if not exists', () => {
            fs.existsSync.mockReturnValue(false);
            const destCb = jest.fn();
            imageStorageConfig.destination({}, {}, destCb);
            expect(fs.mkdirSync).toHaveBeenCalledWith('public/uploads/pemberitahuan', { recursive: true });
        });

        it('should have correct filename logic for image', () => {
            expect(imageStorageConfig).toBeDefined();
            const file = { originalname: 'Image!.jpg' };
            const filenameCb = jest.fn();

            jest.spyOn(Date, 'now').mockReturnValue(1234567890);
            jest.spyOn(Math, 'random').mockReturnValue(0.123456789);

            imageStorageConfig.filename({}, file, filenameCb);

            // Expected: Image_-1234567890-123456789.jpg
            const expectedName = expect.stringMatching(/Image_-\d+-\d+\.jpg/);
            expect(filenameCb).toHaveBeenCalledWith(null, expectedName);

            jest.restoreAllMocks();
        });

        it('should accept valid image files (JPG/PNG/GIF/WebP)', () => {
            expect(imageFilter).toBeDefined();
            const cb = jest.fn();

            imageFilter({}, { originalname: 'test.jpg', mimetype: 'image/jpeg' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);

            imageFilter({}, { originalname: 'test.gif', mimetype: 'image/gif' }, cb);
            expect(cb).toHaveBeenCalledWith(null, true);
        });

        it('should reject invalid file types', () => {
            expect(imageFilter).toBeDefined();
            const cb = jest.fn();

            imageFilter({}, { originalname: 'test.pdf', mimetype: 'application/pdf' }, cb);
            expect(cb).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    // --- uploadImage (Wrapper) ---
    describe('uploadImage (Wrapper)', () => {
        let mockRequest, mockResponse, nextFunction;

        beforeEach(() => {
            mockRequest = {};
            mockResponse = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            nextFunction = jest.fn();
            jest.clearAllMocks();
            jest.resetModules(); // Reset modules to ensure multer mock is fresh
        });

        it('should call next() on successful upload and log success (Line 152)', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            const fileObj = {
                originalname: 'test.jpg',
                filename: 'test.jpg',
                size: 1000,
                path: 'path/test.jpg'
            };

            mockRequest.file = fileObj;

            const mockSingleMiddleware = jest.fn((req, res, cb) => {
                req.file = fileObj;
                cb(null);
            });

            require('multer').mockImplementation(() => ({
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            }));

            jest.isolateModules(() => {
                const { uploadImage } = require('../../middlewares/uploadMiddleware');
                uploadImage(mockRequest, mockResponse, nextFunction);
            });

            expect(mockSingleMiddleware).toHaveBeenCalled();
            expect(nextFunction).toHaveBeenCalled();

            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('File uploaded successfully'),
                expect.objectContaining({
                    originalname: 'test.jpg'
                })
            );

            consoleSpy.mockRestore();
        });

        it('should handle generic errors (Lines 143-144)', () => {
            const mockSingleMiddleware = jest.fn((req, res, cb) => {
                cb(new Error('Generic Error'));
            });

            require('multer').mockReturnValue({
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            });

            jest.isolateModules(() => {
                const { uploadImage } = require('../../middlewares/uploadMiddleware');
                uploadImage(mockRequest, mockResponse, nextFunction);
            });

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                success: false,
                message: 'Generic Error'
            }));
        });

        it('should handle LIMIT_FILE_SIZE error', () => {
            const mockSingleMiddleware = jest.fn((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_FILE_SIZE');
                cb(err);
            });

            require('multer').mockReturnValue({
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            });

            jest.isolateModules(() => {
                const { uploadImage } = require('../../middlewares/uploadMiddleware');
                uploadImage(mockRequest, mockResponse, nextFunction);
            });

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'File terlalu besar. Maksimal 5MB'
            }));
        });

        it('should handle LIMIT_FILE_COUNT error', () => {
            const mockSingleMiddleware = jest.fn((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_FILE_COUNT');
                cb(err);
            });

            require('multer').mockReturnValue({
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            });

            jest.isolateModules(() => {
                const { uploadImage } = require('../../middlewares/uploadMiddleware');
                uploadImage(mockRequest, mockResponse, nextFunction);
            });

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Hanya bisa upload 1 file'
            }));
        });

        it('should handle LIMIT_UNEXPECTED_FILE error', () => {
            const mockSingleMiddleware = jest.fn((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_UNEXPECTED_FILE');
                cb(err);
            });

            require('multer').mockReturnValue({
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            });

            jest.isolateModules(() => {
                const { uploadImage } = require('../../middlewares/uploadMiddleware');
                uploadImage(mockRequest, mockResponse, nextFunction);
            });

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Field file tidak valid. Gunakan field "image"'
            }));
        });

        it('should handle generic Multer errors', () => {
            const mockSingleMiddleware = jest.fn((req, res, cb) => {
                const err = new (require('multer').MulterError)('SOME_OTHER_CODE');
                err.message = 'Some other error';
                cb(err);
            });

            require('multer').mockReturnValue({
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            });

            jest.isolateModules(() => {
                const { uploadImage } = require('../../middlewares/uploadMiddleware');
                uploadImage(mockRequest, mockResponse, nextFunction);
            });

            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Error upload: Some other error'
            }));
        });
    });

    describe('Middleware: uploadFotoKerusakan (Error Handling)', () => {
        let mockReq, mockRes, mockNext;
        let mockMulterInstance;
        let mockSingleMiddleware;

        beforeEach(() => {
            mockReq = {};
            mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            mockNext = jest.fn();

            mockSingleMiddleware = jest.fn();

            mockMulterInstance = {
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            };

            require('multer').mockImplementation(() => mockMulterInstance);
        });

        it('should handle LIMIT_FILE_SIZE error', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_FILE_SIZE');
                cb(err);
            });

            jest.isolateModules(() => {
                const { uploadFotoKerusakan } = require('../../middlewares/uploadMiddleware');
                uploadFotoKerusakan(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Ukuran foto terlalu besar. Maksimal 5MB'
            }));
        });

        it('should handle LIMIT_UNEXPECTED_FILE error', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_UNEXPECTED_FILE');
                cb(err);
            });

            jest.isolateModules(() => {
                const { uploadFotoKerusakan } = require('../../middlewares/uploadMiddleware');
                uploadFotoKerusakan(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Field file tidak valid. Gunakan field "photo"'
            }));
        });

        it('should handle generic Multer errors', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                const err = new (require('multer').MulterError)('SOME_OTHER_CODE');
                err.message = 'Some other error';
                cb(err);
            });

            jest.isolateModules(() => {
                const { uploadFotoKerusakan } = require('../../middlewares/uploadMiddleware');
                uploadFotoKerusakan(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Error upload: Some other error'
            }));
        });

        it('should handle non-Multer errors', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                cb(new Error('Database error'));
            });

            jest.isolateModules(() => {
                const { uploadFotoKerusakan } = require('../../middlewares/uploadMiddleware');
                uploadFotoKerusakan(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Database error'
            }));
        });

        it('should proceed to next() on success', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                cb(null);
            });

            jest.isolateModules(() => {
                const { uploadFotoKerusakan } = require('../../middlewares/uploadMiddleware');
                uploadFotoKerusakan(mockReq, mockRes, mockNext);
            });

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('Middleware: uploadIzinDokumen (Error Handling)', () => {
        let mockReq, mockRes, mockNext;
        let mockMulterInstance;
        let mockSingleMiddleware;

        beforeEach(() => {
            mockReq = {};
            mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
            mockNext = jest.fn();

            mockSingleMiddleware = jest.fn();

            mockMulterInstance = {
                single: jest.fn().mockReturnValue(mockSingleMiddleware),
                any: jest.fn()
            };

            require('multer').mockImplementation(() => mockMulterInstance);
        });

        it('should handle LIMIT_FILE_SIZE error', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_FILE_SIZE');
                cb(err);
            });

            jest.isolateModules(() => {
                const { uploadIzinDokumen } = require('../../middlewares/uploadMiddleware');
                uploadIzinDokumen(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'File terlalu besar. Maksimal 10MB'
            }));
        });

        it('should handle LIMIT_UNEXPECTED_FILE error', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                const err = new (require('multer').MulterError)('LIMIT_UNEXPECTED_FILE');
                cb(err);
            });

            jest.isolateModules(() => {
                const { uploadIzinDokumen } = require('../../middlewares/uploadMiddleware');
                uploadIzinDokumen(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Field file tidak valid. Gunakan field "document"'
            }));
        });

        it('should handle generic Multer errors', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                const err = new (require('multer').MulterError)('SOME_OTHER_CODE');
                err.message = 'Some other error';
                cb(err);
            });

            jest.isolateModules(() => {
                const { uploadIzinDokumen } = require('../../middlewares/uploadMiddleware');
                uploadIzinDokumen(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Error upload: Some other error'
            }));
        });

        it('should handle non-Multer errors', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                cb(new Error('Database error'));
            });

            jest.isolateModules(() => {
                const { uploadIzinDokumen } = require('../../middlewares/uploadMiddleware');
                uploadIzinDokumen(mockReq, mockRes, mockNext);
            });

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
                message: 'Database error'
            }));
        });

        it('should proceed to next() on success', () => {
            mockSingleMiddleware.mockImplementation((req, res, cb) => {
                cb(null);
            });

            jest.isolateModules(() => {
                const { uploadIzinDokumen } = require('../../middlewares/uploadMiddleware');
                uploadIzinDokumen(mockReq, mockRes, mockNext);
            });

            expect(mockNext).toHaveBeenCalled();
        });
    });
});