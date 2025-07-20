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
      document.getElementById('employee-page').classList.remove('hidden');
      loadInventory('employee-inventory-list');
      loadSharedReports('shared-reports');
    }
  }).catch(error => {
    console.error('Lỗi kiểm tra vai trò:', error);
    alert('Lỗi kiểm tra vai trò: ' + error.message);
  });
}
