import { auth, database } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError, showSuccess } from './utils.js';

// 1. Định nghĩa hàm (KHÔNG export ở đây)
async function handleLogin() {
  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  
  if (!email || !password) {
    showError('Vui lòng nhập đầy đủ thông tin đăng nhập');
    return;
  }
  
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById('loadingIndicator').classList.add('hidden');
  } catch (error) {
    document.getElementById('loadingIndicator').classList.add('hidden');
    showError(`Đăng nhập thất bại: ${error.message}`);
  }
}

// 2. Định nghĩa hàm (KHÔNG export ở đây)
async function handleLogout() {
  try {
    await signOut(auth);
    showSuccess('Bạn đã đăng xuất thành công');
  } catch (error) {
    showError(`Lỗi khi đăng xuất: ${error.message}`);
  }
}

// 3. Định nghĩa hàm (KHÔNG export ở đây)
async function addUser() {
  // ... giữ nguyên nội dung hàm
}

// 4. Export DUY NHẤT MỘT LẦN ở cuối file
export { handleLogin, handleLogout, addUser };

// 5. Expose ra window cho các sự kiện HTML
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.addUser = addUser;
