auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
  .then(() => {
    console.log('Đã thiết lập persistence đăng nhập: LOCAL');
  })
  .catch(error => {
    console.error('Lỗi thiết lập persistence:', error);
  });

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

  if (!email || !password) {
    document.getElementById('error').textContent = 'Vui lòng nhập email và mật khẩu.';
    document.getElementById('error').classList.remove('hidden');
    return;
  }

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
      alert('Lỗi: Không tìm thấy dữ liệu người dùng.');
      return;
    }

    document.getElementById('login-page').classList.add('hidden');

    const role = userData.role;
    if (role === 'manager') {
      const managerPage = document.getElementById('manager-page');
      if (!managerPage) {
        console.error('Không tìm thấy manager-page');
        alert('Lỗi: Không tìm thấy giao diện quản lý.');
        return;
      }
      managerPage.classList.remove('hidden');
      loadInventory('inventory-list');
      loadSharedReports('manager-shared-reports');
    } else if (role === 'employee' || role === 'staff') {
      const employeePage = document.getElementById('employee-page');
      if (!employeePage) {
        console.error('Không tìm thấy employee-page');
        alert('Lỗi: Không tìm thấy giao diện nhân viên.');
        return;
      }
      employeePage.classList.remove('hidden');
      loadEmployeeInventory('employee-inventory');
      displaySharedReportSummary(new Date().toISOString().split('T')[0]);
    } else {
      console.error('Vai trò không hợp lệ:', role);
      alert('Lỗi: Vai trò người dùng không hợp lệ.');
    }
  }).catch(error => {
    console.error('Lỗi kiểm tra vai trò:', error);
    alert('Lỗi kiểm tra vai trò: ' + error.message);
  });
}
function parseCostString(costStr) {
  if (!costStr) return 0;
  const numbers = costStr.match(/\d+/g);
  return numbers ? numbers.reduce((sum, num) => sum + Number(num), 0) : 0;
}

function formatTimestamp(ts) {
  const date = new Date(ts);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')} ${date.toLocaleDateString('vi-VN')}`;
}

function fetchReportSummary(date, filterType, callback) {
  const reportsRef = firebase.database().ref('shared_reports');
  const usersRef = firebase.database().ref('users');

  reportsRef.orderByChild('date').equalTo(date).once('value').then(snapshot => {
    const allReports = [];
    snapshot.forEach(child => allReports.push({ id: child.key, ...child.val() }));

    usersRef.once('value').then(userSnap => {
      const users = userSnap.val() || {};
      const group = { opening: [], cost: [], revenue: [], closing: [], exports: [] };
      let sum = { opening: 0, cost: 0, revenue: 0, closing: 0, export: 0 };

      allReports.forEach(r => {
        const name = users[r.uid]?.name || r.uid.substring(0, 6);
        const time = formatTimestamp(r.timestamp);
        group.opening.push(`${r.openingBalance || 0} - ${name} ${time}`);
        group.cost.push(`${r.cost || '0'} - ${name} ${time}`);
        group.revenue.push(`${r.revenue || 0} - ${name} ${time}`);
        group.closing.push(`${r.closingBalance || 0} - ${name} ${time}`);

        sum.opening += r.openingBalance || 0;
        sum.revenue += r.revenue || 0;
        sum.closing += r.closingBalance || 0;
        sum.cost += parseCostString(r.cost);

        if (r.exports) {
          r.exports.forEach(e => {
            group.exports.push(`${e.quantity} ${e.productName || e.productId} - ${name} ${time}`);
            sum.export += e.quantity || 0;
          });
        }
      });

      sum.real = sum.opening + sum.revenue - sum.cost - sum.closing;
      callback(group, sum, allReports, null);
    }).catch(error => {
      console.error('Lỗi tải thông tin người dùng:', error);
      callback(null, null, null, error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền truy cập danh sách người dùng.' : error.message);
    });
  }).catch(error => {
    console.error('Lỗi tải báo cáo:', error);
    callback(null, null, null, error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền truy cập báo cáo.' : error.message);
  });
}

function loadInventoryData(containerId, renderCallback) {
  const inventoryList = document.getElementById(containerId);
  if (!inventoryList) {
    console.error(`Không tìm thấy container ${containerId}`);
    return;
  }

  inventoryList.innerHTML = '<p class="text-gray-500">Đang tải dữ liệu...</p>';
  db.ref('inventory').on('value', snapshot => {
    inventoryList.innerHTML = '';
    const data = snapshot.val();
    if (!data) {
      inventoryList.innerHTML = '<p class="text-gray-500">Không có dữ liệu tồn kho.</p>';
      return;
    }

    Object.entries(data).forEach(([productId, product]) => {
      const div = document.createElement('div');
      div.className = 'p-2 border-b';
      renderCallback(div, productId, product);
      inventoryList.appendChild(div);
    });
    console.log(`Đã tải danh sách tồn kho thành công cho ${containerId}`);
  }, error => {
    console.error('Lỗi tải tồn kho:', error);
    inventoryList.innerHTML = `<p class="text-red-500">${error.code === 'PERMISSION_DENIED' ? 'Bạn không có quyền truy cập tồn kho.' : 'Lỗi tải tồn kho.'}</p>`;
  });
}
function clearBrowserCache() {
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
