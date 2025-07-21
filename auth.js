auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('auth: Đã thiết lập persistence đăng nhập: LOCAL');
  })
  .catch(error => {
    console.error('auth: Lỗi thiết lập persistence:', error);
    alert('Lỗi thiết lập phiên đăng nhập: ' + error.message);
  });

window.onload = function() {
  console.log('auth: Window loaded, checking saved credentials');
  const savedEmail = localStorage.getItem('savedEmail');
  const savedPassword = localStorage.getItem('savedPassword');
  if (savedEmail && savedPassword) {
    document.getElementById('email').value = savedEmail;
    document.getElementById('password').value = savedPassword;
    document.getElementById('save-password').checked = true;
  }

  auth.onAuthStateChanged(user => {
    if (user) {
      console.log('auth: User authenticated, UID:', user.uid);
      checkUserRole(user.uid);
    } else {
      console.log('auth: No user authenticated, showing login page');
      document.getElementById('login-page').classList.remove('hidden');
      document.getElementById('employee-page').classList.add('hidden');
      document.getElementById('manager-page').classList.add('hidden');
    }
  });
};

function login() {
  console.log('auth: Attempting login');
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const savePassword = document.getElementById('save-password').checked;

  if (!email || !password) {
    console.error('auth: Missing email or password');
    document.getElementById('error').textContent = 'Vui lòng nhập email và mật khẩu.';
    document.getElementById('error').classList.remove('hidden');
    return;
  }

  document.getElementById('error').classList.add('hidden');
  document.getElementById('login-page').innerHTML += '<p class="text-gray-500 text-center">Đang đăng nhập...</p>';

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
      console.log('auth: Login successful, User UID:', user.uid);
      checkUserRole(user.uid);
    })
    .catch(error => {
      let errorMessage = 'Lỗi đăng nhập: ' + error.message;
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email không hợp lệ.';
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Email hoặc mật khẩu không đúng.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Quá nhiều lần thử đăng nhập. Vui lòng thử lại sau.';
      }
      console.error('auth: Login failed:', errorMessage);
      document.getElementById('error').textContent = errorMessage;
      document.getElementById('error').classList.remove('hidden');
      document.getElementById('login-page').innerHTML = document.getElementById('login-page').innerHTML.replace('<p class="text-gray-500 text-center">Đang đăng nhập...</p>', '');
    });
}

function checkUserRole(uid) {
  console.log('auth: Checking role for UID:', uid);
  db.ref(`users/${uid}`).once('value').then(snapshot => {
    const userData = snapshot.val();
    if (!userData) {
      console.error('auth: No user data found for UID:', uid);
      alert('Lỗi: Không tìm thấy dữ liệu người dùng.');
      auth.signOut();
      document.getElementById('login-page').classList.remove('hidden');
      document.getElementById('employee-page').classList.add('hidden');
      document.getElementById('manager-page').classList.add('hidden');
      return;
    }

    console.log('auth: User data:', userData);
    document.getElementById('login-page').classList.add('hidden');

    const role = userData.role;
    if (role === 'manager') {
      console.log('auth: Manager role detected, showing manager page');
      const managerPage = document.getElementById('manager-page');
      if (!managerPage) {
        console.error('auth: Manager page not found');
        alert('Lỗi: Không tìm thấy giao diện quản lý.');
        return;
      }
      managerPage.classList.remove('hidden');
      managerPage.style.display = 'block';
      document.getElementById('employee-page').classList.add('hidden');
      loadInventory('inventory-list');
      loadSharedReports('manager-shared-reports');
    } else if (role === 'employee' || role === 'staff') {
      console.log('auth: Employee role detected, showing employee page');
      const employeePage = document.getElementById('employee-page');
      if (!employeePage) {
        console.error('auth: Employee page not found');
        alert('Lỗi: Không tìm thấy giao diện nhân viên.');
        return;
      }
      employeePage.classList.remove('hidden');
      employeePage.style.display = 'block';
      document.getElementById('manager-page').classList.add('hidden');
      loadEmployeeInventory('employee-inventory');
      displaySharedReportSummary(new Date().toISOString().split('T')[0]);
    } else {
      console.error('auth: Invalid role:', role);
      alert('Lỗi: Vai trò người dùng không hợp lệ.');
      auth.signOut();
      document.getElementById('login-page').classList.remove('hidden');
      document.getElementById('employee-page').classList.add('hidden');
      document.getElementById('manager-page').classList.add('hidden');
    }
  }).catch(error => {
    console.error('auth: Error checking role:', error);
    alert(error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền truy cập dữ liệu người dùng.' : 'Lỗi kiểm tra vai trò: ' + error.message);
    auth.signOut();
    document.getElementById('login-page').classList.remove('hidden');
    document.getElementById('employee-page').classList.add('hidden');
    document.getElementById('manager-page').classList.add('hidden');
  });
}

function clearBrowserCache() {
  console.log('auth: Clearing browser cache');
  if (confirm("Bạn có chắc muốn xóa cache trình duyệt? Trang sẽ được tải lại.")) {
    localStorage.clear();
    sessionStorage.clear();
    if (caches && caches.keys) {
      caches.keys().then(names => {
        for (let name of names) caches.delete(name);
      }).finally(() => {
        location.reload(true);
      });
    } else {
      location.reload(true);
    }
  }
}
