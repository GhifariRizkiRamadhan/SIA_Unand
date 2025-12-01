// tests/unit/notification.test.js
const mockPrismaNotificationCreate = jest.fn();
const mockPrismaNotificationUpdateMany = jest.fn();
const mockPrismaNotificationFindMany = jest.fn();
const mockPrismaMahasiswaFindUnique = jest.fn();
const mockPrismaMahasiswaFindMany = jest.fn();
const mockPrismaPengelolaFindMany = jest.fn();

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    notification: {
      create: mockPrismaNotificationCreate,
      updateMany: mockPrismaNotificationUpdateMany,
      findMany: mockPrismaNotificationFindMany
    },
    mahasiswa: {
      findUnique: mockPrismaMahasiswaFindUnique,
      findMany: mockPrismaMahasiswaFindMany
    },
    pengelolaasrama: {
      findMany: mockPrismaPengelolaFindMany
    }
  })),
}));

// Mock global.io for socket.io emissions
global.io = {
  to: jest.fn().mockReturnThis(),
  emit: jest.fn()
};

const controller = require('../../controller/notification');

describe('Unit Test: controller/notification.js (Notification Management)', () => {
  let mockRequest, mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockRequest = {
      session: { user_id: 'user-1' },
      user: { user_id: 'user-1' },
      params: {}
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    global.io.to.mockReturnThis();
    global.io.emit.mockClear();
  });

  // --- createNotification ---
  it('createNotification: Creates notification and emits socket event', async () => {
    const mockNotificationData = {
      notification_id: 1,
      title: 'Test Title',
      message: 'Test message',
      type: 'test',
      user_id: 'user-1',
      reference_id: '123',
      created_at: new Date(),
      is_read: false
    };

    mockPrismaNotificationCreate.mockResolvedValue(mockNotificationData);

    const result = await controller.createNotification('user-1', 'Test Title', 'Test message', 'test', '123');

    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith({
      data: {
        title: 'Test Title',
        message: 'Test message',
        type: 'test',
        user_id: 'user-1',
        reference_id: '123'
      }
    });
    expect(global.io.to).toHaveBeenCalledWith('user-1');
    expect(global.io.emit).toHaveBeenCalled();
    expect(result).toEqual(mockNotificationData);
  });

  it('createNotification: Converts numeric referenceId to string', async () => {
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createNotification('user-1', 'Title', 'Message', 'type', 456);

    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference_id: '456'
      })
    });
  });

  it('createNotification: Handles null referenceId', async () => {
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createNotification('user-1', 'Title', 'Message', 'type', null);

    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reference_id: null
      })
    });
  });

  it('createNotification: Throws error on database failure', async () => {
    mockPrismaNotificationCreate.mockRejectedValue(new Error('DB Error'));

    await expect(controller.createNotification('user-1', 'Title', 'Message', 'type')).rejects.toThrow('DB Error');
  });

  // --- getNotifications ---
  it('getNotifications: Returns 401 when user not authenticated', async () => {
    mockRequest.session = {};
    mockRequest.user = null;

    await controller.getNotifications(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  it('getNotifications: Returns notifications separated by read/unread', async () => {
    const mockNotifications = [
      { notification_id: 1, is_read: false, created_at: new Date() },
      { notification_id: 2, is_read: false, created_at: new Date() },
      { notification_id: 3, is_read: true, created_at: new Date() }
    ];

    mockPrismaNotificationFindMany.mockResolvedValue(mockNotifications);

    await controller.getNotifications(mockRequest, mockResponse);

    expect(mockPrismaNotificationFindMany).toHaveBeenCalled();
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        unreadCount: 2
      })
    }));
  });

  it('getNotifications: Filters notifications from last 7 days', async () => {
    mockPrismaNotificationFindMany.mockResolvedValue([]);

    await controller.getNotifications(mockRequest, mockResponse);

    const callArgs = mockPrismaNotificationFindMany.mock.calls[0][0];
    expect(callArgs.where.user_id).toBe('user-1');
    expect(callArgs.where.created_at.gte).toBeDefined();
  });

  // --- markAsRead ---
  it('markAsRead: Returns 401 when user not authenticated', async () => {
    mockRequest.session = {};
    mockRequest.user = null;

    await controller.markAsRead(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });

  it('markAsRead: Updates notification to read', async () => {
    mockRequest.params = { notificationId: '5' };
    mockPrismaNotificationUpdateMany.mockResolvedValue({ count: 1 });

    await controller.markAsRead(mockRequest, mockResponse);

    expect(mockPrismaNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        notification_id: 5,
        user_id: 'user-1'
      },
      data: {
        is_read: true
      }
    });
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  // --- markAllAsRead ---
  it('markAllAsRead: Returns 401 when user not authenticated', async () => {
    mockRequest.session = {};
    mockRequest.user = null;

    await controller.markAllAsRead(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(401);
  });

  it('markAllAsRead: Updates all unread notifications to read', async () => {
    mockPrismaNotificationUpdateMany.mockResolvedValue({ count: 3 });

    await controller.markAllAsRead(mockRequest, mockResponse);

    expect(mockPrismaNotificationUpdateMany).toHaveBeenCalledWith({
      where: {
        user_id: 'user-1',
        is_read: false
      },
      data: {
        is_read: true
      }
    });
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  // --- createSuratBebasAsramaNotification ---
  it('createSuratBebasAsramaNotification: Sends notifications to all pengelola', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };
    const mockPengelolas = [
      { user_id: 'pengelola-1', user: { user_id: 'pengelola-1' } },
      { user_id: 'pengelola-2', user: { user_id: 'pengelola-2' } }
    ];

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaPengelolaFindMany.mockResolvedValue(mockPengelolas);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createSuratBebasAsramaNotification(1, 'surat-123');

    expect(mockPrismaMahasiswaFindUnique).toHaveBeenCalled();
    expect(mockPrismaPengelolaFindMany).toHaveBeenCalled();
    expect(mockPrismaNotificationCreate).toHaveBeenCalledTimes(2);
  });

  // --- createStatusUpdateNotification ---
  it('createStatusUpdateNotification: Sends notification to mahasiswa', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createStatusUpdateNotification(1, 'approved', 'surat-123');

    expect(mockPrismaMahasiswaFindUnique).toHaveBeenCalled();
    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Update Status Surat Bebas Asrama',
        type: 'status_update'
      })
    }));
  });

  // --- createPemberitahuanNotification ---
  it('createPemberitahuanNotification: Sends notifications to all mahasiswa', async () => {
    const mockMahasiswas = [
      { mahasiswa_id: 1, user: { user_id: 'user-1' } },
      { mahasiswa_id: 2, user: { user_id: 'user-2' } },
      { mahasiswa_id: 3, user: { user_id: 'user-3' } }
    ];

    mockPrismaMahasiswaFindMany.mockResolvedValue(mockMahasiswas);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createPemberitahuanNotification('Pemberitahuan Penting', 'pb-123');

    expect(mockPrismaMahasiswaFindMany).toHaveBeenCalled();
    expect(mockPrismaNotificationCreate).toHaveBeenCalledTimes(3);
  });

  // --- createIzinKeluarNotification ---
  it('createIzinKeluarNotification: Sends to pengelola for new request', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };
    const mockPengelolas = [
      { user_id: 'pengelola-1', user: { user_id: 'pengelola-1' } }
    ];

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaPengelolaFindMany.mockResolvedValue(mockPengelolas);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createIzinKeluarNotification(1, 'izin-123', null);

    expect(mockPrismaPengelolaFindMany).toHaveBeenCalled();
    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Pengajuan Izin Keluar Baru',
        type: 'izin_keluar'
      })
    }));
  });

  it('createIzinKeluarNotification: Sends to mahasiswa for status update', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createIzinKeluarNotification(1, 'izin-123', 'approved');

    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Update Status Izin Keluar',
        type: 'izin_keluar_status'
      })
    }));
  });

  // --- createKerusakanNotification ---
  it('createKerusakanNotification: Sends to pengelola for new report', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };
    const mockPengelolas = [
      { user_id: 'pengelola-1', user: { user_id: 'pengelola-1' } }
    ];

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaPengelolaFindMany.mockResolvedValue(mockPengelolas);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createKerusakanNotification(1, 'kerusakan-123', null);

    expect(mockPrismaPengelolaFindMany).toHaveBeenCalled();
    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Laporan Kerusakan Baru',
        type: 'kerusakan'
      })
    }));
  });

  it('createKerusakanNotification: Sends to mahasiswa for status update', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createKerusakanNotification(1, 'kerusakan-123', 'ditangani');

    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Update Status Laporan Kerusakan',
        type: 'kerusakan_status'
      })
    }));
  });

  // --- createPembayaranNotification ---
  it('createPembayaranNotification: Sends to mahasiswa for payment status', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createPembayaranNotification(1, 'payment-123', 'pending');

    expect(mockPrismaMahasiswaFindUnique).toHaveBeenCalled();
    expect(mockPrismaNotificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        title: 'Update Status Pembayaran',
        type: 'pembayaran'
      })
    }));
  });

  it('createPembayaranNotification: Sends to pengelola when payment successful', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };
    const mockPengelolas = [
      { user_id: 'pengelola-1', user: { user_id: 'pengelola-1' } }
    ];

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaPengelolaFindMany.mockResolvedValue(mockPengelolas);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createPembayaranNotification(1, 'payment-123', 'berhasil');

    expect(mockPrismaNotificationCreate).toHaveBeenCalledTimes(2);
    expect(mockPrismaPengelolaFindMany).toHaveBeenCalled();
  });

  it('createPembayaranNotification: Does not notify pengelola for non-successful status', async () => {
    const mockMahasiswa = {
      mahasiswa_id: 1,
      user: { user_id: 'user-1', name: 'John Doe' }
    };

    mockPrismaMahasiswaFindUnique.mockResolvedValue(mockMahasiswa);
    mockPrismaNotificationCreate.mockResolvedValue({ notification_id: 1 });

    await controller.createPembayaranNotification(1, 'payment-123', 'failed');

    expect(mockPrismaNotificationCreate).toHaveBeenCalledTimes(1);
    expect(mockPrismaPengelolaFindMany).not.toHaveBeenCalled();
  });

  // --- Error Handling ---
  it('createSuratBebasAsramaNotification: Handles errors gracefully', async () => {
    mockPrismaMahasiswaFindUnique.mockRejectedValue(new Error('DB Error'));

    await expect(controller.createSuratBebasAsramaNotification(1, 'surat-123')).rejects.toThrow('DB Error');
  });

  it('createIzinKeluarNotification: Handles errors gracefully', async () => {
    mockPrismaMahasiswaFindUnique.mockRejectedValue(new Error('DB Error'));

    await expect(controller.createIzinKeluarNotification(1, 'izin-123', null)).rejects.toThrow('DB Error');
  });

  it('getNotifications: Handles database errors', async () => {
    mockPrismaNotificationFindMany.mockRejectedValue(new Error('DB Error'));

    await controller.getNotifications(mockRequest, mockResponse);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });
});
