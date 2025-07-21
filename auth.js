import { setPersistence, signInWithEmailAndPassword, browserLocalPersistence, browserSessionPersistence, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';

setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log('Đã thiết lập persistence đăng nhập: LOCAL');
  })
  .catch(error => {
    console.error('Lỗi thiết lập persistence:', error);
  });

function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const rememberMe = document.getElementById('remember-me') ? document.getElementById('remember-me').checked : false;

  if (!email || !password) {
    alert('Vui lòng nhập email và mật khẩu.');
    return;
  }

  setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence)
    .then(() => {
      return signInWithEmailAndPassword(auth, email, password);
    })
    .then(userCredential => {
      console.log('User UID:', userCredential.user.uid);
    })
    .catch(error => {
      console.error('Lỗi đăng nhập:', error);
      alert('Lỗi đăng nhập: ' + error.message);
    });
}

onAuthStateChanged(auth, user => {
  if (user) {
    db.ref('users/' + user.uid).once('value').then(snapshot => {
      const userData = snapshot.val();
      if (userData && userData.role === 'manager') {
        console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('manager-page').classList.remove('hidden');
        document.getElementById('employee-page').classList.add('hidden');
        loadInventory('inventory-list');
        loadSharedReports('report-table');
      } else {
        console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('employee-page').classList.remove('hidden');
        document.getElementById('manager-page').classList.add('hidden');
        loadInventory('inventory-list');
        loadSharedReports('report-table');
      }
    }).catch(error => {
      console.error('Lỗi lấy thông tin người dùng:', error);
      alert('Lỗi: ' + error.message);
    });
  } else {
    console.log('Không có người dùng, hiển thị trang đăng nhập...');
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('manager-page').classList.add('hidden');
    document.getElementById('employee-page').classList.add('hidden');
  }
});
