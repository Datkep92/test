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
      console.log('Đăng nhập thành công, User UID:', userCredential.user.uid);
    })
    .catch(error => {
      console.error('Lỗi đăng nhập:', error);
      alert('Lỗi đăng nhập: ' + error.message);
    });
}

let isRoleChecked = false;

auth.onAuthStateChanged(user => {
  console.log('Auth state changed, user:', user ? user.uid : 'null');
  const loginPage = document.getElementById('login-page');
  const managerPage = document.getElementById('manager-page');
  const employeePage = document.getElementById('employee-page');

  if (!loginPage || !managerPage || !employeePage) {
    console.error('Một hoặc nhiều phần tử DOM không tồn tại:', { loginPage, managerPage, employeePage });
    alert('Lỗi: Không tìm thấy một hoặc nhiều phần tử giao diện.');
    return;
  }

  if (user && !isRoleChecked) {
    isRoleChecked = true;
    console.log('Kiểm tra vai trò cho UID:', user.uid);
    db.ref('users/' + user.uid).once('value').then(snapshot => {
      const userData = snapshot.val();
      console.log('Dữ liệu người dùng:', userData);
      if (userData) {
        if (userData.role === 'manager') {
          console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
          loginPage.style.display = 'none';
          managerPage.style.display = 'block';
          employeePage.style.display = 'none';
          if (document.getElementById('manager-inventory-list') && document.getElementById('shared-report-table')) {
            loadInventory('manager-inventory-list');
            loadSharedReports('shared-report-table');
            loadExpenseSummary('expense-summary-table');
          } else {
            console.error('Không tìm thấy các phần tử trong manager-page.');
          }
        } else if (userData.role === 'employee') {
          console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
          loginPage.style.display = 'none';
          employeePage.style.display = 'block';
          managerPage.style.display = 'none';
          if (document.getElementById('employee-inventory-list') && document.getElementById('shared-report-table')) {
            loadInventory('employee-inventory-list');
            loadSharedReports('shared-report-table');
            loadExpenseSummary('expense-summary-table');
          } else {
            console.error('Không tìm thấy các phần tử trong employee-page.');
          }
        } else {
          console.error('Vai trò không xác định:', userData.role);
          alert('Lỗi: Vai trò không được xác định.');
        }
      } else {
        console.error('Không tìm thấy dữ liệu vai trò cho UID:', user.uid);
        alert('Lỗi: Không tìm thấy dữ liệu người dùng.');
      }
    }).catch(error => {
      console.error('Lỗi lấy thông tin người dùng:', error);
      alert('Lỗi: ' + error.message);
    });
  } else if (!user) {
    console.log('Không có người dùng, hiển thị trang đăng nhập...');
    loginPage.style.display = 'block';
    managerPage.style.display = 'none';
    employeePage.style.display = 'none';
    isRoleChecked = false;
  }
});
