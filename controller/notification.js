const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Fungsi untuk membuat notifikasi baru
const createNotification = async (userId, title, message, type, referenceId = null) => {
  try {
    // Convert referenceId to string if it's not null
    const stringReferenceId = referenceId ? referenceId.toString() : null;

    const notification = await prisma.notification.create({
      data: {
        title,
        message,
        type,
        user_id: userId,
        reference_id: stringReferenceId
      }
    });

    // Emit event notifikasi baru melalui socket.io
    global.io.to(userId).emit('new_notification', {
      notification_id: notification.notification_id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      created_at: notification.created_at,
      is_read: false
    });

    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Get notifikasi untuk user tertentu
const getNotifications = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Hitung waktu 7 hari yang lalu
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Ambil notifikasi dalam 7 hari terakhir, urutkan berdasarkan tanggal terbaru
    const notifications = await prisma.notification.findMany({
      where: {
        user_id: userId,
        created_at: {
          gte: sevenDaysAgo
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Pisahkan notifikasi read dan unread
    const unreadNotifications = notifications.filter(n => !n.is_read);
    const readNotifications = notifications.filter(n => n.is_read);

    res.json({
      success: true,
      data: {
        unread: unreadNotifications,
        read: readNotifications,
        unreadCount: unreadNotifications.length
      }
    });

  } catch (error) {
    console.error('Error getting notifications:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
};

// Tandai notifikasi sebagai telah dibaca
const markAsRead = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { notificationId } = req.params;

    // Update notifikasi
    await prisma.notification.updateMany({
      where: {
        notification_id: parseInt(notificationId),
        user_id: userId
      },
      data: {
        is_read: true
      }
    });

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
};

// Tandai semua notifikasi sebagai telah dibaca
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.session?.user_id || req.user?.user_id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Update semua notifikasi yang belum dibaca
    await prisma.notification.updateMany({
      where: {
        user_id: userId,
        is_read: false
      },
      data: {
        is_read: true
      }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message
    });
  }
};

// Fungsi untuk membuat notifikasi bebas asrama
const createSuratBebasAsramaNotification = async (mahasiswaId, suratId) => {
  try {
    // Ambil data mahasiswa
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: mahasiswaId },
      include: { user: true }
    });

    // Ambil semua pengelola untuk diberikan notifikasi
    const pengelolas = await prisma.pengelolaasrama.findMany({
      include: { user: true }
    });

    // Buat notifikasi untuk setiap pengelola
    const notifications = pengelolas.map(pengelola => 
      createNotification(
        pengelola.user_id,
        'Pengajuan Surat Bebas Asrama Baru',
        `${mahasiswa.user.name} telah mengajukan surat bebas asrama`,
        'surat_bebas_asrama',
        suratId.toString()
      )
    );

    await Promise.all(notifications);
  } catch (error) {
    console.error('Error creating surat bebas asrama notification:', error);
    throw error;
  }
};

// Fungsi untuk membuat notifikasi update status surat bebas asrama
const createStatusUpdateNotification = async (mahasiswaId, status, suratId) => {
  try {
    // Ambil data mahasiswa
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: mahasiswaId },
      include: { user: true }
    });

    // Buat notifikasi untuk mahasiswa
    await createNotification(
      mahasiswa.user_id,
      'Update Status Surat Bebas Asrama',
      `Status surat bebas asrama Anda telah diperbarui menjadi "${status}"`,
      'status_update',
      suratId.toString()
    );
  } catch (error) {
    console.error('Error creating status update notification:', error);
    throw error;
  }
};

// Fungsi untuk membuat notifikasi pemberitahuan baru
const createPemberitahuanNotification = async (title, pemberitahuanId) => {
  try {
    // Ambil semua mahasiswa untuk diberikan notifikasi
    const mahasiswas = await prisma.mahasiswa.findMany({
      include: { user: true }
    });

    // Buat notifikasi untuk setiap mahasiswa
    const notifications = mahasiswas.map(mahasiswa =>
      createNotification(
        mahasiswa.user_id,
        'Pemberitahuan Baru',
        `Ada pemberitahuan baru: "${title}"`,
        'pemberitahuan',
        pemberitahuanId.toString()
      )
    );

    await Promise.all(notifications);
  } catch (error) {
    console.error('Error creating pemberitahuan notification:', error);
    throw error;
  }
};

// Fungsi untuk membuat notifikasi izin keluar
const createIzinKeluarNotification = async (mahasiswaId, izinId, status = null) => {
  try {
    // Jika status null, berarti ini pengajuan baru
    if (!status) {
      // Ambil data mahasiswa
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { mahasiswa_id: mahasiswaId },
        include: { user: true }
      });

      // Notifikasi ke pengelola
      const pengelolas = await prisma.pengelolaasrama.findMany({
        include: { user: true }
      });

      const notifications = pengelolas.map(pengelola =>
        createNotification(
          pengelola.user_id,
          'Pengajuan Izin Keluar Baru',
          `${mahasiswa.user.name} telah mengajukan izin keluar asrama`,
          'izin_keluar',
          izinId.toString()
        )
      );

      await Promise.all(notifications);
    } else {
      // Update status - notifikasi ke mahasiswa
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { mahasiswa_id: mahasiswaId },
        include: { user: true }
      });

      await createNotification(
        mahasiswa.user_id,
        'Update Status Izin Keluar',
        `Status izin keluar Anda telah diperbarui menjadi "${status}"`,
        'izin_keluar_status',
        izinId.toString()
      );
    }
  } catch (error) {
    console.error('Error creating izin keluar notification:', error);
    throw error;
  }
};

// Fungsi untuk membuat notifikasi pelaporan kerusakan
const createKerusakanNotification = async (mahasiswaId, kerusakanId, status = null) => {
  try {
    if (!status) {
      // Pelaporan baru
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { mahasiswa_id: mahasiswaId },
        include: { user: true }
      });

      const pengelolas = await prisma.pengelolaasrama.findMany({
        include: { user: true }
      });

      const notifications = pengelolas.map(pengelola =>
        createNotification(
          pengelola.user_id,
          'Laporan Kerusakan Baru',
          `${mahasiswa.user.name} telah melaporkan kerusakan fasilitas`,
          'kerusakan',
          kerusakanId.toString()
        )
      );

      await Promise.all(notifications);
    } else {
      // Update status
      const mahasiswa = await prisma.mahasiswa.findUnique({
        where: { mahasiswa_id: mahasiswaId },
        include: { user: true }
      });

      await createNotification(
        mahasiswa.user_id,
        'Update Status Laporan Kerusakan',
        `Status laporan kerusakan Anda telah diperbarui menjadi "${status}"`,
        'kerusakan_status',
        kerusakanId.toString()
      );
    }
  } catch (error) {
    console.error('Error creating kerusakan notification:', error);
    throw error;
  }
};

// Fungsi untuk membuat notifikasi pembayaran
const createPembayaranNotification = async (mahasiswaId, pembayaranId, status) => {
  try {
    // Ambil data mahasiswa
    const mahasiswa = await prisma.mahasiswa.findUnique({
      where: { mahasiswa_id: mahasiswaId },
      include: { user: true }
    });

    // Notifikasi ke mahasiswa
    await createNotification(
      mahasiswa.user_id,
      'Update Status Pembayaran',
      `Status pembayaran Anda telah diperbarui menjadi "${status}"`,
      'pembayaran',
      pembayaranId.toString()
    );

    // Jika pembayaran berhasil, notifikasi ke pengelola
    if (status === 'berhasil') {
      const pengelolas = await prisma.pengelolaasrama.findMany({
        include: { user: true }
      });

      const notifications = pengelolas.map(pengelola =>
        createNotification(
          pengelola.user_id,
          'Pembayaran Baru',
          `${mahasiswa.user.name} telah melakukan pembayaran`,
          'pembayaran_berhasil',
          pembayaranId.toString()
        )
      );

      await Promise.all(notifications);
    }
  } catch (error) {
    console.error('Error creating pembayaran notification:', error);
    throw error;
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  createNotification,
  createSuratBebasAsramaNotification,
  createStatusUpdateNotification,
  createPemberitahuanNotification,
  createIzinKeluarNotification,
  createKerusakanNotification,
  createPembayaranNotification
};
