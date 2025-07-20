import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, query, collection, where } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
export const db = getFirestore(app);

export function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        document.getElementById('loginBox').classList.add('hidden');
        document.getElementById('appHeader').classList.remove('hidden');
        document.getElementById('currentUser').textContent = userDoc.data().username;
        if (userDoc.data().role === 'admin') {
          document.getElementById('adminApp').classList.remove('hidden');
        } else {
          document.getElementById('saleApp').classList.remove('hidden');
        }
      }
    } else {
      document.getElementById('loginBox').classList.remove('hidden');
      document.getElementById('appHeader').classList.add('hidden');
      document.getElementById('saleApp').classList.add('hidden');
      document.getElementById('adminApp').classList.add('hidden');
    }
  });

  document.getElementById('login-button').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value.trim();
    const rememberMe = document.getElementById('rememberMe').checked;
    const errorContainer = document.getElementById('errorContainer');

    if (!username || !password) {
      errorContainer.innerHTML = '<div class="error-message">Vui lòng nhập đầy đủ thông tin đăng nhập</div>';
      return;
    }

    try {
      const userSnapshot = await getDocs(query(collection(db, 'users'), where('username', '==', username)));
      if (userSnapshot.empty) {
        errorContainer.innerHTML = '<div class="error-message">Sai tên đăng nhập</div>';
        return;
      }
      const userDoc = userSnapshot.docs[0];
      if (!userDoc.data().active) {
        errorContainer.innerHTML = '<div class="error-message">Tài khoản đã bị khóa</div>';
        return;
      }
      await signInWithEmailAndPassword(auth, userDoc.data().email, password);
      if (rememberMe) {
        localStorage.setItem('rememberedUser', username);
      } else {
        localStorage.removeItem('rememberedUser');
      }
    } catch (error) {
      errorContainer.innerHTML = `<div class="error-message">Lỗi đăng nhập: ${error.message}</div>`;
    }
  });

  document.getElementById('logout-button').addEventListener('click', () => {
    signOut(auth).then(() => console.log('Đăng xuất thành công'));
  });

  const rememberedUser = localStorage.getItem('rememberedUser');
  if (rememberedUser) {
    document.getElementById('username').value = rememberedUser;
    document.getElementById('password').focus();
  }

  document.getElementById('password').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('login-button').click();
  });
}

export { auth };