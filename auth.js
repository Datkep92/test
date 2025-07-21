// auth.js

function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const rememberMe = document.getElementById('remember-me')?.checked || false;

  if (!email || !password) {
    alert('Vui lòng nhập email và mật khẩu.');
    return;
  }

  auth.setPersistence(rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION)
    .then(() => auth.signInWithEmailAndPassword(email, password))
    .then(userCredential => {
      console.log('Đăng nhập thành công:', userCredential.user.uid);
    })
    .catch(error => {
      alert('Lỗi đăng nhập: ' + error.message);
      console.error(error);
    });
}

function logout() {
  auth.signOut().then(() => {
    alert('Đăng xuất thành công!');
    showPage('login');
  });
}

function showPage(role) {
  document.getElementById('login-page').style.display = role === 'login' ? 'block' : 'none';
  document.getElementById('manager-page').style.display = role === 'manager' ? 'block' : 'none';
  document.getElementById('employee-page').style.display = role === 'employee' ? 'block' : 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

  auth.onAuthStateChanged(user => {
    if (!user) {
      showPage('login');
      return;
    }

    db.ref('users/' + user.uid).once('value').then(snapshot => {
      const userData = snapshot.val();
      if (!userData || !userData.role) {
        alert('Tài khoản chưa được phân quyền.');
        showPage('login');
        return;
      }

      const role = userData.role;
      const uid = user.uid;
      console.log('Đăng nhập với vai trò:', role);

      if (role === 'manager') {
        showPage('manager');
        loadInventory('inventory-list-manager', 'manager');
        loadExpenseSummary('expense-summary-table-manager');
        loadSharedReports('shared-report-table-manager', uid);
      } else {
        showPage('employee');
        loadInventory('inventory-list-employee', 'employee');
        loadExpenseSummary('expense-summary-table-employee');
        loadSharedReports('shared-report-table-employee', uid);
      }
    }).catch(error => {
      alert('Lỗi khi lấy dữ liệu người dùng: ' + error.message);
      console.error(error);
      showPage('login');
    });
  });
});
