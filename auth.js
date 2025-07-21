firebase.auth().setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => console.log('Đã thiết lập persistence đăng nhập: LOCAL'));

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    console.log('Không có người dùng đăng nhập');
    document.getElementById('login-section').classList.remove('hidden');
    document.getElementById('manager-section').classList.add('hidden');
    document.getElementById('employee-section').classList.add('hidden');
    return;
  }
av
  const userRef = db.ref(`users/${user.uid}`);
  const snapshot = await userRef.once('value');
  const userData = snapshot.val();

  if (!userData || !userData.role || userData.active === false) {
    document.getElementById('loginError').innerText = 'Tài khoản bị vô hiệu hóa hoặc thiếu thông tin.';
    firebase.auth().signOut();
    return;
  }

  document.getElementById('login-section').classList.add('hidden');

  if (userData.role === 'manager') {
    document.getElementById('manager-section').classList.remove('hidden');
    ReportManager.loadInventory('managerInventoryList', 'manager');
    ReportManager.loadSharedReports('managerSharedReport', 'manager');
  } 
  else if (userData.role === 'employee') {
    document.getElementById('employee-section').classList.remove('hidden');
    ReportManager.loadInventory('employeeInventoryList', 'employee');
    ReportManager.loadSharedReports('employeeSharedReport', 'employee');
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
