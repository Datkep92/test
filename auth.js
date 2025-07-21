firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log('Đã thiết lập persistence đăng nhập: LOCAL'));

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    console.log('Không có người dùng đăng nhập');
    return;
  }

  console.log('Auth state changed, user:', user.uid);

  const userRef = firebase.database().ref(`users/${user.uid}`);
  const snapshot = await userRef.once('value');
  const userData = snapshot.val();

  console.log('Dữ liệu người dùng:', userData);

  if (!userData || !userData.role || userData.active === false) {
    document.getElementById('loginError').innerText = 'Tài khoản bị vô hiệu hóa hoặc thiếu thông tin.';
    firebase.auth().signOut();
    return;
  }

  const role = userData.role;
  document.getElementById('login-page').classList.add('hidden');

  if (role === 'manager') {
    console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
    document.getElementById('manager-page').classList.remove('hidden');

    const ids = [
      'managerInventoryList',
      'sharedReportTable',
      'expenseSummaryTable'
    ];
    const domStatus = checkDomExists(ids);
    console.log('Kiểm tra DOM manager-page:', domStatus);
  }

  if (role === 'employee') {
    console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
    document.getElementById('employee-page').classList.remove('hidden');

    const ids = [
      'employeeInventoryList',
      'sharedReportTable',
      'reportFilter',
      'reportDate',
      'expenseSummaryTable'
    ];
    const domStatus = checkDomExists(ids);
    console.log('Kiểm tra DOM employee-page:', domStatus);
  }
});

function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  firebase.auth().signInWithEmailAndPassword(email, password)
    .catch(error => {
      console.error('Lỗi đăng nhập:', error.message);
      document.getElementById('loginError').innerText = 'Sai tài khoản hoặc mật khẩu.';
    });
}

function checkDomExists(ids = []) {
  return ids.reduce((acc, id) => {
    acc[id] = !!document.getElementById(id);
    return acc;
  }, {});
}
