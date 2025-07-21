auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('Đã thiết lập persistence đăng nhập: LOCAL');
  })
  .catch(error => {
    console.error('Lỗi thiết lập persistence:', error);
  });

function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const rememberMeCheckbox = document.getElementById('remember-me');
  const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

  if (!email || !password) {
    alert('Vui lòng nhập email và mật khẩu.');
    return;
  }

  auth.setPersistence(rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION)
    .then(() => {
      return auth.signInWithEmailAndPassword(email, password);
    })
    .then(userCredential => {
      console.log('User UID:', userCredential.user.uid);
    })
    .catch(error => {
      console.error('Lỗi đăng nhập:', error);
      alert('Lỗi đăng nhập: ' + error.message);
    });
}

auth.onAuthStateChanged(user => {
  if (user) {
    db.ref('users/' + user.uid).once('value').then(snapshot => {
      const userData = snapshot.val();
      if (userData && userData.role === 'manager') {
        console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('manager-page').classList.remove('hidden');
        document.getElementById('employee-page').classList.add('hidden');
        loadInventory('manager-inventory-list');
        loadSharedReports('manager-report-table');
      } else {
        console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
        document.getElementById('login-page').classList.add('hidden');
        document.getElementById('employee-page').classList.remove('hidden');
        document.getElementById('manager-page').classList.add('hidden');
        loadInventory('employee-inventory-list');
        loadSharedReports('employee-report-table');
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
