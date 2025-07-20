import { database } from './firebase-config.js';
import { ref, get, update, remove } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError, showSuccess } from './utils.js';

export async function toggleUserStatus(uid) {
  try {
    const userRef = ref(database, `users/${uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      const newStatus = !userData.active;
      
      await update(userRef, { active: newStatus });
      renderUserList();
      
      showSuccess(`Trạng thái người dùng đã được cập nhật`);
    }
  } catch (error) {
    showError(`Lỗi khi cập nhật trạng thái người dùng: ${error.message}`);
  }
}

export async function deleteUser(uid) {
  if (confirm('Bạn có chắc muốn xóa người dùng này?')) {
    try {
      // Remove user from Realtime Database
      const userRef = ref(database, `users/${uid}`);
      await remove(userRef);
      
      // Refresh user list
      renderUserList();
      
      showSuccess('Người dùng đã được xóa');
    } catch (error) {
      showError(`Lỗi khi xóa người dùng: ${error.message}`);
    }
  }
}

export async function renderUserList() {
  const table = document.querySelector('#userTable tbody');
  table.innerHTML = '';
  
  try {
    const usersRef = ref(database, 'users');
    const snapshot = await get(usersRef);
    
    if (snapshot.exists()) {
      const users = snapshot.val();
      
      for (const uid in users) {
        const user = users[uid];
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${user.email}</td>
          <td>${user.role === 'admin' ? 'Quản lý' : 'Nhân viên'}</td>
          <td>${user.active ? 'Đang hoạt động' : 'Đã khóa'}</td>
          <td class="actions">
            <button onclick="toggleUserStatus('${uid}')" class="${user.active ? 'warning' : 'success'}">
              ${user.active ? '🔒 Khóa' : '🔓 Mở khóa'}
            </button>
            <button onclick="deleteUser('${uid}')" class="danger">🗑️ Xóa</button>
          </td>
        `;
        table.appendChild(row);
      }
    }
  } catch (error) {
    showError(`Lỗi khi tải danh sách người dùng: ${error.message}`);
  }
}

// Expose functions to window
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
