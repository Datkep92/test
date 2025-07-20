
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
      console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
      document.getElementById('login-page').classList.add('hidden');
      document.getElementById('manager-page').classList.remove('hidden');
      loadInventory();
      loadSharedReports('manager-shared-reports');
    } else {
      console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
      document.getElementById('login-page').classList.add('hidden');
      loadEmployeePage();
    }
  }).catch(error => {
    console.error('Lỗi kiểm tra vai trò:', error);
    alert('Lỗi kiểm tra vai trò: ' + error.message);
  });
}

function loadEmployeePage() {
  const employeePage = document.getElementById('employee-page');
  if (employeePage && !employeePage.classList.contains('hidden')) {
    console.log('Giao diện nhân viên đã sẵn sàng, tải dữ liệu...');
    employeePage.classList.remove('hidden');
    loadInventory('employee-inventory-list');
    loadProducts();
    loadSharedReports('shared-reports');
    return;
  }

  console.log('Giao diện nhân viên chưa sẵn sàng, thiết lập MutationObserver...');
  const observer = new MutationObserver((mutations, obs) => {
    const employeePage = document.getElementById('employee-page');
    if (employeePage && !employeePage.classList.contains('hidden')) {
      console.log('MutationObserver: Giao diện nhân viên đã xuất hiện, tải dữ liệu...');
      employeePage.classList.remove('hidden');
      loadInventory('employee-inventory-list');
      loadProducts();
      loadSharedReports('shared-reports');
      obs.disconnect(); // Ngừng quan sát sau khi tải thành công
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class']
  });

  // Timeout sau 5 giây nếu không phát hiện giao diện
  setTimeout(() => {
    if (document.getElementById('employee-page').classList.contains('hidden')) {
      console.error('Timeout: Không thể tải giao diện nhân viên sau 5 giây.');
      alert('Lỗi: Không thể tải giao diện nhân viên. Vui lòng làm mới trang hoặc kiểm tra giao diện.');
      observer.disconnect();
    }
  }, 5000);
}
