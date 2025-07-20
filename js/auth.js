import { auth, database } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  signOut, 
  createUserWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { ref, set } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { showError, showSuccess } from './utils.js';

export async function handleLogin() {
  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value.trim();
  
  // Clear previous errors
  document.getElementById('errorContainer').innerHTML = '';
  
  if (!email || !password) {
    showError('Vui lòng nhập đầy đủ thông tin đăng nhập');
    return;
  }
  
  try {
    document.getElementById('loadingIndicator').classList.remove('hidden');
    
    // Sign in with Firebase Authentication
    await signInWithEmailAndPassword(auth, email, password);
    
    // Hide loading indicator
    document.getElementById('loadingIndicator').classList.add('hidden');
  } catch (error) {
    document.getElementById('loadingIndicator').classList.add('hidden');
    showError(`Đăng nhập thất bại: ${error.message}`);
  }
}

export async function handleLogout() {
  try {
    await signOut(auth);
    showSuccess('Bạn đã đăng xuất thành công');
  } catch (error) {
    showError(`Lỗi khi đăng xuất: ${error.message}`);
  }
}

export async function addUser() {
  const email = document.getElementById('newUsername').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const role = document.getElementById('newUserRole').value;
  
  if (!email || !password) {
    showError('Vui lòng nhập đầy đủ email và mật khẩu');
    return;
  }
  
  try {
    // Create user in Firebase Authentication
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save user info to Firebase Realtime Database
    const userRef = ref(database, `users/${user.uid}`);
    await set(userRef, {
      email: email,
      role: role,
      active: true
    });
    
    // Clear inputs
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    
    // Refresh user list
    renderUserList();
    
    showSuccess(`Người dùng ${email} đã được thêm thành công`);
  } catch (error) {
    showError(`Lỗi khi thêm người dùng: ${error.message}`);
  }
}
export { handleLogin, handleLogout, addUser };
