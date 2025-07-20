import { db, auth } from './auth.js';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { createUserWithEmailAndPassword } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';

export function initUsers() {
  document.getElementById('add-user').addEventListener('click', async () => {
    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value.trim();
    const role = document.getElementById('newUserRole').value;

    if (!username || !password) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu</div>';
      return;
    }

    try {
      const userSnapshot = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
      if (!userSnapshot.empty) {
        document.getElementById('errorContainer').innerHTML = '<div class="error-message">Tên đăng nhập đã tồn tại</div>';
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, `${username}@example.com`, password);
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        username,
        role,
        active: true,
        email: `${username}@example.com`
      });
      document.getElementById('newUsername').value = '';
      document.getElementById('newPassword').value = '';
    } catch (error) {
      document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  });

  onSnapshot(collection(db, 'users'), (snapshot) => {
    const table = document.querySelector('#userTable tbody');
    const userFilter = document.getElementById('reportUserFilter');
    table.innerHTML = '';
    userFilter.innerHTML = '<option value="all">Tất cả người dùng</option>';
    snapshot.forEach((doc) => {
      const user = doc.data();
      const row = `<tr>
        <td>${user.username}</td>
        <td>${user.role === 'admin' ? 'Quản lý' : 'Nhân viên'}</td>
        <td>${user.active ? 'Đang hoạt động' : 'Đã khóa'}</td>
        <td class="actions manager-only">
          <button class="${user.active ? 'warning' : 'success'}" onclick="toggleUserStatus('${doc.id}')">${user.active ? 'Khóa' : 'Mở khóa'}</button>
          ${user.username !== 'admin' ? `<button class="danger" onclick="deleteUser('${doc.id}')">Xóa</button>` : ''}
        </td>
      </tr>`;
      table.innerHTML += row;
      const option = document.createElement('option');
      option.value = doc.id;
      option.textContent = user.username;
      userFilter.appendChild(option);
    });
  });
}

export async function toggleUserStatus(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Người dùng không tồn tại');
    await updateDoc(userRef, { active: !userSnap.data().active });
  } catch (error) {
    document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
  }
}

export async function deleteUser(userId) {
  if ((await getDoc(doc(db, 'users', userId))).data().username === 'admin') {
    document.getElementById('errorContainer').innerHTML = '<div class="error-message">Không thể xóa tài khoản admin</div>';
    return;
  }
  if (confirm('Bạn có chắc muốn xóa tài khoản này?')) {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  }
}