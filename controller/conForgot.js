const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Show forgot password form
const showForgotPassword = (req, res) => {
    res.render('forgotPassword', {
        error: null,
        success: null
    });
};

// Process forgot password (reset password)
const resetPassword = async (req, res) => {
    try {
        const { email, newPassword, confirmPassword } = req.body;

        // Validasi input
        if (!email || !newPassword || !confirmPassword) {
            return res.render('forgotPassword', {
                error: 'Semua field harus diisi!',
                success: null
            });
        }

        // Validasi password match
        if (newPassword !== confirmPassword) {
            return res.render('forgotPassword', {
                error: 'Password baru dan konfirmasi password tidak cocok!',
                success: null
            });
        }

        // Validasi panjang password
        if (newPassword.length < 8) {
            return res.render('forgotPassword', {
                error: 'Password harus minimal 8 karakter!',
                success: null
            });
        }

        // Cek apakah user dengan email tersebut ada
        const user = await prisma.user.findUnique({
            where: { email: email }
        });

        if (!user) {
            return res.render('forgotPassword', {
                error: 'Email tidak terdaftar dalam sistem!',
                success: null
            });
        }

        // Hash password baru
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update password di database
        await prisma.user.update({
            where: { email: email },
            data: { password: hashedPassword }
        });

        // Redirect ke login dengan pesan sukses
        return res.redirect('/login?success=' + encodeURIComponent('Password berhasil direset! Silakan login dengan password baru Anda.'));

    } catch (error) {
        console.error('Error reset password:', error);
        return res.render('forgotPassword', {
            error: 'Terjadi kesalahan saat mereset password. Silakan coba lagi.',
            success: null
        });
    }
};

module.exports = {
    showForgotPassword,
    resetPassword
};