
// Thiết lập persistence để giữ trạng thái đăng nhập
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('Đã thiết lập persistence đăng nhập: LOCAL');
  })
  .catch(error => {
    console.error('Lỗi thiết lập persistence:', error);
  });

// Load saved credentials if available
window.onload = function() {
  const savedEmail = localStorage.getItem('savedEmail');
  const savedPassword = localStorage.getItem('savedPassword');
  if (savedEmail && savedPassword) {
    document.getElementById('email').value = savedEmail;
    document.getElementById('password').value = savedPassword;
    document.getElementById('save-password').checked = true;
  }
};

function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const savePassword = document.getElementById('save-password').checked;

  if (savePassword) {
    localStorage.setItem('savedEmail', email);
    localStorage.setItem('savedPassword', password);
  } else {
    localStorage.removeItem('savedEmail');
    localStorage.removeItem('savedPassword');
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(userCredential => {
      const user = userCredential.user;
      console.log('User UID:', user.uid);
      checkUserRole(user.uid);
    })
    .catch(error => {
      document.getElementById('error').textContent = 'Lỗi đăng nhập: ' + error.message;
      document.getElementById('error').classList.remove('hidden');
    });
}

function checkUserRole(uid) {
  db.ref('users/' + uid).once('value').then(snapshot => {
    const userData = snapshot.val();
    if (userData && userData.role === 'manager') {
      document.getElementById('login-page').classList.add('hidden');
      document.getElementById('manager-page').classList.remove('hidden');
      loadInventory();
      loadSharedReports('manager-shared-reports');
    } else {
      document.getElementById('login-page').classList.add('hidden');
      // Chờ giao diện nhân viên hiển thị
      setTimeout(() => {
        const employeePage = document.getElementById('employee-page');
        if (employeePage && !employeePage.classList.contains('hidden')) {
          loadInventory('employee-inventory-list');
          loadProducts();
          loadSharedReports('shared-reports');
        } else {
          console.error('Giao diện nhân viên chưa sẵn sàng.');
          alert('Lỗi: Giao diện nhân viên chưa tải. Vui lòng thử lại.');
        }
      }, 100); // Delay để đảm bảo DOM sẵn sàng
    }
  }).catch(error => {
    console.error('Lỗi kiểm tra vai trò:', error);
    alert('Lỗi kiểm tra vai trò: ' + error.message);
  });
}
