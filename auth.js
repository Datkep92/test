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
    if (!userData) {
      console.error('Không tìm thấy dữ liệu người dùng cho UID:', uid);
      alert('Lỗi: Không tìm thấy dữ liệu người dùng. Vui lòng kiểm tra cấu hình.');
      return;
    }

    document.getElementById('login-page').classList.add('hidden');

    const role = userData.role;
    if (role === 'manager') {
      console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
      const managerPage = document.getElementById('manager-page');
      if (!managerPage) {
        console.error('Không tìm thấy phần tử manager-page trong DOM');
        alert('Lỗi: Không tìm thấy giao diện quản lý. Vui lòng kiểm tra giao diện.');
        return;
      }
      managerPage.classList.remove('hidden');

      if (typeof loadInventory === 'function') {
        loadInventory('inventory-list');
      } else {
        console.warn('Không tìm thấy hàm loadInventory trong manager.js');
      }

      loadSharedReports('manager-shared-reports');

    } else if (role === 'employee' || role === 'staff') {
      console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
      const employeePage = document.getElementById('employee-page');
      if (!employeePage) {
        console.error('Không tìm thấy phần tử employee-page trong DOM');
        alert('Lỗi: Không tìm thấy giao diện nhân viên. Vui lòng kiểm tra giao diện.');
        return;
      }
      employeePage.classList.remove('hidden');

      if (typeof loadEmployeeInventory === 'function') {
        loadEmployeeInventory('inventory-list');
      } else {
        console.warn('Không tìm thấy hàm loadEmployeeInventory, thử fallback...');
        if (typeof loadInventory === 'function') {
          loadInventory('inventory-list');
        } else {
          console.error('Không tìm thấy hàm loadInventory nào!');
        }
      }

      loadSharedReports('shared-reports');

    } else {
      console.error('Vai trò người dùng không hợp lệ:', role);
      alert('Lỗi: Vai trò người dùng không hợp lệ.');
    }
  }).catch(error => {
    console.error('Lỗi kiểm tra vai trò:', error);
    alert('Lỗi kiểm tra vai trò: ' + error.message);
  });
}

function clearBrowserCache() {
  if (confirm("Bạn có chắc muốn xóa cache trình duyệt? Trang sẽ được tải lại.")) {
    localStorage.clear();
    sessionStorage.clear();
    if (caches && caches.keys) {
      caches.keys().then(function(names) {
        for (let name of names) caches.delete(name);
      }).finally(() => {
        location.reload(true); // Force reload không cache
      });
    } else {
      location.reload(true);
    }
  }
}
