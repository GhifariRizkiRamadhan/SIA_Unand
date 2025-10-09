// Fungsi untuk mengelola tampilan tab notifikasi
function initNotificationTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const notificationContainers = {
        all: document.getElementById('allNotifications'),
        unread: document.getElementById('unreadNotifications'),
        read: document.getElementById('readNotifications')
    };

    // Set default active tab to "Semua"
    showTab('all');

    // Tambahkan event listener untuk setiap tab button
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            showTab(tabName);
        });
    });

    function showTab(tabName) {
        // Update active state pada button
        tabButtons.forEach(button => {
            if (button.getAttribute('data-tab') === tabName) {
                button.classList.add('active', 'border-purple-600', 'text-purple-600');
                button.classList.remove('border-transparent', 'text-gray-500');
            } else {
                button.classList.remove('active', 'border-purple-600', 'text-purple-600');
                button.classList.add('border-transparent', 'text-gray-500');
            }
        });

        // Tampilkan container yang sesuai
        Object.keys(notificationContainers).forEach(containerName => {
            if (containerName === tabName) {
                notificationContainers[containerName].classList.remove('hidden');
            } else {
                notificationContainers[containerName].classList.add('hidden');
            }
        });
    }
}

// Fungsi untuk memperbarui tampilan notifikasi
function updateNotificationDisplay(notifications) {
    const allContainer = document.getElementById('allNotifications');
    const unreadContainer = document.getElementById('unreadNotifications');
    const readContainer = document.getElementById('readNotifications');

    // Sortir notifikasi berdasarkan tanggal terbaru
    const allNotifications = [...notifications.unread, ...notifications.read]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Update semua notifikasi
    allContainer.innerHTML = allNotifications.length > 0 
        ? allNotifications.map(notification => createNotificationElement(notification)).join('')
        : '<div class="p-4 text-center text-gray-500">Tidak ada notifikasi</div>';

    // Update notifikasi belum dibaca
    unreadContainer.innerHTML = notifications.unread.length > 0
        ? notifications.unread.map(notification => createNotificationElement(notification)).join('')
        : '<div class="p-4 text-center text-gray-500">Tidak ada notifikasi yang belum dibaca</div>';

    // Update notifikasi sudah dibaca
    readContainer.innerHTML = notifications.read.length > 0
        ? notifications.read.map(notification => createNotificationElement(notification)).join('')
        : '<div class="p-4 text-center text-gray-500">Tidak ada notifikasi yang sudah dibaca</div>';

    // Update counter badge
    const notificationCount = document.getElementById('notificationCount');
    if (notifications.unread.length > 0) {
        notificationCount.textContent = notifications.unread.length;
        notificationCount.classList.remove('hidden');
    } else {
        notificationCount.classList.add('hidden');
    }
}

// Initialize when document is ready
document.addEventListener('DOMContentLoaded', () => {
    initNotificationTabs();
});