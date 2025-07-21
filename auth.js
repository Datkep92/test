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

function logout() {
  auth.signOut()
    .then(() => {
      console.log('Đăng xuất thành công');
      alert('Đăng xuất thành công!');
      document.getElementById('login-page').style.display = 'block';
      document.getElementById('manager-page').style.display = 'none';
      document.getElementById('employee-page').style.display = 'none';
    })
    .catch(error => {
      console.error('Lỗi đăng xuất:', error);
      alert('Lỗi đăng xuất: ' + error.message);
    });
}

document.addEventListener('DOMContentLoaded', () => {
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
    .then(() => {
      console.log('Đã thiết lập persistence đăng nhập: LOCAL');
    })
    .catch(error => {
      console.error('Lỗi thiết lập persistence:', error);
    });

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
          loginPage.style.display = 'none';
          if (userData.role === 'manager') {
            console.log('Đăng nhập quản lý, hiển thị giao diện quản lý...');
            managerPage.style.display = 'block';
            employeePage.style.display = 'none';
            console.log('Kiểm tra script reports.js đã tải:', typeof loadSharedReports, typeof loadInventory, typeof loadExpenseSummary);
            if (document.getElementById('manager-inventory-list') && document.getElementById('shared-report-table') && document.getElementById('expense-summary-table')) {
              if (typeof loadSharedReports === 'function') {
                console.log('Gọi loadSharedReports cho shared-report-table (manager)');
                loadSharedReports('shared-report-table', user.uid);
              } else {
                console.error('loadSharedReports không được định nghĩa');
                document.getElementById('shared-report-table').innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo tổng hợp.</p>';
              }
              if (typeof loadInventory === 'function') {
                console.log('Gọi loadInventory cho manager-inventory-list');
                loadInventory('manager-inventory-list');
              } else {
                console.error('loadInventory không được định nghĩa');
                document.getElementById('manager-inventory-list').innerHTML = '<p style="margin: 0;">Lỗi tải danh sách tồn kho.</p>';
              }
              if (typeof loadExpenseSummary === 'function') {
                console.log('Gọi loadExpenseSummary cho expense-summary-table (manager)');
                loadExpenseSummary('expense-summary-table');
              } else {
                console.error('loadExpenseSummary không được định nghĩa');
                document.getElementById('expense-summary-table').innerHTML = '<p style="margin: 0;">Lỗi tải tổng hợp chi phí.</p>';
              }
            } else {
              console.error('Không tìm thấy các phần tử trong manager-page:', {
                managerInventoryList: !!document.getElementById('manager-inventory-list'),
                sharedReportTable: !!document.getElementById('shared-report-table'),
                expenseSummaryTable: !!document.getElementById('expense-summary-table')
              });
              alert('Lỗi: Không tìm thấy các phần tử trong giao diện quản lý.');
              managerPage.style.display = 'block';
            }
          } else if (userData.role === 'employee') {
            console.log('Đăng nhập nhân viên, hiển thị giao diện nhân viên...');
            employeePage.style.display = 'block';
            managerPage.style.display = 'none';
            console.log('Kiểm tra script reports.js đã tải:', typeof loadSharedReports, typeof loadInventory, typeof loadExpenseSummary);
            if (document.getElementById('employee-inventory-list') && document.getElementById('shared-report-table') && document.getElementById('report-filter') && document.getElementById('report-date') && document.getElementById('expense-summary-table')) {
              if (typeof loadSharedReports === 'function') {
                console.log('Gọi loadSharedReports cho shared-report-table (employee)');
                loadSharedReports('shared-report-table', user.uid);
              } else {
                console.error('loadSharedReports không được định nghĩa');
                document.getElementById('shared-report-table').innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo tổng hợp.</p>';
              }
              if (typeof loadInventory === 'function') {
                console.log('Gọi loadInventory cho employee-inventory-list');
                loadInventory('employee-inventory-list');
              } else {
                console.error('loadInventory không được định nghĩa');
                document.getElementById('employee-inventory-list').innerHTML = '<p style="margin: 0;">Lỗi tải danh sách tồn kho.</p>';
              }
              if (typeof loadExpenseSummary === 'function') {
                console.log('Gọi loadExpenseSummary cho expense-summary-table (employee)');
                loadExpenseSummary('expense-summary-table');
              } else {
                console.error('loadExpenseSummary không được định nghĩa');
                document.getElementById('expense-summary-table').innerHTML = '<p style="margin: 0;">Lỗi tải tổng hợp chi phí.</p>';
              }
            } else {
              console.error('Không tìm thấy các phần tử trong employee-page:', {
                employeeInventoryList: !!document.getElementById('employee-inventory-list'),
                sharedReportTable: !!document.getElementById('shared-report-table'),
                reportFilter: !!document.getElementById('report-filter'),
                reportDate: !!document.getElementById('report-date'),
                expenseSummaryTable: !!document.getElementById('expense-summary-table')
              });
              alert('Lỗi: Không tìm thấy các phần tử trong giao diện nhân viên.');
              employeePage.style.display = 'block';
            }
          } else {
            console.error('Vai trò không xác định:', userData.role);
            alert('Lỗi: Vai trò không được xác định.');
            loginPage.style.display = 'block';
          }
        } else {
          console.error('Không tìm thấy dữ liệu vai trò cho UID:', user.uid);
          alert('Lỗi: Không tìm thấy dữ liệu người dùng.');
          loginPage.style.display = 'block';
        }
      }).catch(error => {
        console.error('Lỗi lấy thông tin người dùng:', error);
        alert('Lỗi: ' + error.message);
        loginPage.style.display = 'block';
      });
    } else if (!user) {
      console.log('Không có người dùng, hiển thị trang đăng nhập...');
      loginPage.style.display = 'block';
      managerPage.style.display = 'none';
      employeePage.style.display = 'none';
      isRoleChecked = false;
    }
  });
});
