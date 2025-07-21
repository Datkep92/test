```javascript
function loadSharedReports(elementId, userRole, userId) {
  const reportsList = document.getElementById(elementId);
  const filter = document.getElementById(`${userRole}-report-filter`);
  const dateInput = document.getElementById(`${userRole}-report-date`);

  if (!reportsList || !filter || !dateInput) {
    console.error('Không tìm thấy phần tử shared-report-table, report-filter hoặc report-date trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo, bộ lọc hoặc mục chọn ngày.');
    return;
  }

  const updateReports = () => {
    const selectedDate = dateInput.value;
    const dateKey = selectedDate ? new Date(selectedDate).toLocaleDateString('vi-VN').replace(/\//g, '_') : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');

    db.ref('dailyData').on('value', snapshot => {
      reportsList.innerHTML = '';
      const data = snapshot.val();
      if (!data) {
        reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo.</p>';
        console.log('Không có dữ liệu báo cáo trong dailyData.');
        return;
      }

      const filterType = filter.value;
      let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
      let expenseDetails = [], revenueDetails = [], exportDetails = [];
      let reportRows = [];

      Object.entries(data).forEach(([date, users]) => {
        const formattedDate = date.replace(/_/g, '/');
        const key = filterType === 'day' ? formattedDate : formattedDate.substring(3);
        if (filterType === 'day' && date !== dateKey) return;
        if (filterType === 'month' && formattedDate.substring(3) !== new Date(selectedDate).toLocaleDateString('vi-VN').substring(3)) return;

        Object.entries(users).forEach(([uid, report]) => {
          if (!/^[a-zA-Z0-9]+$/.test(uid)) {
            console.warn('Bỏ qua key không hợp lệ:', uid);
            return;
          }
          totalInitial += report.initialInventory || 0;
          totalFinal += report.finalInventory || 0;
          totalRevenue += report.revenue || 0;
          if (report.expense && report.expense.amount) {
            totalExpense += report.expense.amount;
            expenseDetails.push(`${report.expense.amount} (Thông tin: ${report.expense.info || 'Không có'}, Nhân viên: ${report.user}, Thời gian: ${new Date(report.expense.timestamp).toLocaleString()})`);
            // Thêm nút xóa cho mỗi chi tiết chi phí
            if (userRole === 'manager' || (userRole === 'employee' && uid ===�

System: * Today's date and time is 11:18 PM +07 on Monday, July 21, 2025.

Bạn đã yêu cầu kiểm tra và cập nhật logic hiển thị bảng báo cáo trong tab nhân viên, sử dụng chung logic báo cáo tổng của quản lý, đồng thời thêm quyền xóa báo cáo: nhân viên chỉ được xóa báo cáo của chính họ, còn quản lý có quyền xóa toàn bộ. Dưới đây là các thay đổi và giải pháp được đề xuất bằng tiếng Việt.

### Phân tích yêu cầu
1. **Kiểm tra logic hiển thị bảng báo cáo**:
   - Hàm `loadSharedReports` trong `employee.js` và `manager.js` hiện có logic gần giống nhau, chỉ khác về ID của các phần tử DOM (`manager-report-filter` vs `employee-report-filter`, `manager-report-date` vs `employee-report-date`). Điều này cho phép tái sử dụng logic chung.
   - Báo cáo được lấy từ `dailyData` trong Firebase, lọc theo ngày hoặc tháng, hiển thị các thông tin như tồn kho, doanh thu, chi phí, và xuất kho.

2. **Tái sử dụng logic báo cáo tổng**:
   - Tạo một hàm chung `loadSharedReports` trong file mới `reports.js` để cả `manager.js` và `employee.js` sử dụng, giảm trùng lặp mã.
   - Hàm này cần nhận thêm tham số `userRole` (quản lý hoặc nhân viên) và `userId` để kiểm soát quyền xóa.

3. **Quyền xóa báo cáo**:
   - **Nhân viên**: Chỉ hiển thị nút xóa cho các báo cáo do chính họ tạo (dựa trên `uid` hoặc `email` của người dùng hiện tại).
   - **Quản lý**: Hiển thị nút xóa cho tất cả báo cáo.
   - Thêm logic xóa vào hàm `loadSharedReports` và hàm xử lý sự kiện xóa trong `reports.js`.

4. **Cập nhật giao diện**:
   - Thêm cột hoặc nút xóa trong HTML của bảng báo cáo trong `index.html`.
   - Đảm bảo giao diện hiển thị nút xóa dựa trên vai trò người dùng.

5. **Hành vi ngày mới**:
   - Logic hiện tại trong `submitEmployeeReport` (trong `employee.js`) đã sử dụng `new Date().toLocaleDateString('vi-VN')` để tạo `dateKey` theo định dạng `dd_mm_yyyy`, đảm bảo báo cáo mới được tạo cho mỗi ngày mới. Không cần thay đổi logic này.

### Các thay đổi cần thực hiện
- **Tạo file `reports.js`**: Chứa hàm `loadSharedReports` chung, xử lý logic hiển thị báo cáo và quyền xóa.
- **Cập nhật `index.html`**: Thêm cột xóa trong phần hiển thị báo cáo.
- **Cập nhật `manager.js` và `employee.js`**: Sử dụng hàm `loadSharedReports` từ `reports.js` và truyền tham số vai trò người dùng.
- **Cập nhật `auth.js`**: Truyền vai trò người dùng vào các hàm tải báo cáo.
- **Giữ nguyên các file khác**: `styles.css`, `firebase-config.js`, và `README.md` không cần thay đổi vì không liên quan trực tiếp đến logic báo cáo hoặc xóa.

Dưới đây là các file được cập nhật, sử dụng thẻ `<xaiArtifact>`.

<xaiArtifact artifact_id="54862d03-f4f4-428c-a391-d56acab0c233" artifact_version_id="29b8c1eb-1fda-451a-a9e2-c4bc574de7f6" title="reports.js" contentType="text/javascript">
```javascript
function loadSharedReports(elementId, userRole, userId) {
  const reportsList = document.getElementById(elementId);
  const filter = document.getElementById(`${userRole}-report-filter`);
  const dateInput = document.getElementById(`${userRole}-report-date`);

  if (!reportsList || !filter || !dateInput) {
    console.error('Không tìm thấy phần tử shared-report-table, report-filter hoặc report-date trong DOM');
    alert('Lỗi: Không tìm thấy bảng báo cáo, bộ lọc hoặc mục chọn ngày.');
    return;
  }

  const updateReports = () => {
    const selectedDate = dateInput.value;
    const dateKey = selectedDate ? new Date(selectedDate).toLocaleDateString('vi-VN').replace(/\//g, '_') : new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');

    db.ref('dailyData').on('value', snapshot => {
      reportsList.innerHTML = '';
      const data = snapshot.val();
      if (!data) {
        reportsList.innerHTML = '<p style="margin: 0;">Không có báo cáo.</p>';
        console.log('Không có dữ liệu báo cáo trong dailyData.');
        return;
      }

      const filterType = filter.value;
      let totalInitial = 0, totalFinal = 0, totalRevenue = 0, totalExpense = 0, totalExport = 0;
      let expenseDetails = [], revenueDetails = [], exportDetails = [];
      let reportRows = [];

      Object.entries(data).forEach(([date, users]) => {
        const formattedDate = date.replace(/_/g, '/');
        const key = filterType === 'day' ? formattedDate : formattedDate.substring(3);
        if (filterType === 'day' && date !== dateKey) return;
        if (filterType === 'month' && formattedDate.substring(3) !== new Date(selectedDate).toLocaleDateString('vi-VN').substring(3)) return;

        Object.entries(users).forEach(([uid, report]) => {
          if (!/^[a-zA-Z0-9]+$/.test(uid)) {
            console.warn('Bỏ qua key không hợp lệ:', uid);
            return;
          }
          totalInitial += report.initialInventory || 0;
          totalFinal += report.finalInventory || 0;
          totalRevenue += report.revenue || 0;
          if (report.expense && report.expense.amount) {
            totalExpense += report.expense.amount;
            const expenseDetail = `${report.expense.amount} (Thông tin: ${report.expense.info || 'Không có'}, Nhân viên: ${report.user}, Thời gian: ${new Date(report.expense.timestamp).toLocaleString()})`;
            // Thêm nút xóa cho chi tiết chi phí nếu là quản lý hoặc nhân viên sở hữu báo cáo
            const canDelete = userRole === 'manager' || (userRole === 'employee' && uid === userId);
            expenseDetails.push(`
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${expenseDetail}</span>
                ${canDelete ? `<button onclick="deleteReport('${date}', '${uid}')" style="padding: 4px 8px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer;">Xóa</button>` : ''}
              </div>
            `);
          }
          if (report.revenue) {
            revenueDetails.push(`${report.revenue} (Nhân viên: ${report.user})`);
          }
          if (report.exports) {
            Object.values(report.exports).forEach(exportItem => {
              totalExport += exportItem.quantity || 0;
              exportDetails.push(`${exportItem.quantity} ${exportItem.productName} (Nhân viên: ${report.user})`);
            });
          }
        });
      });

      const remainingBalance = totalRevenue - totalExpense;

      let html = `
        <div style="margin-bottom: 16px; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
          <p><strong>Tổng Tồn kho đầu kỳ:</strong> ${totalInitial}</p>
          <p><strong>Tổng Tồn kho cuối kỳ:</strong> ${totalFinal}</p>
          <p><strong>Tổng Doanh Thu:</strong> ${totalRevenue}</p>
          <p><strong>Tổng Chi Phí:</strong> ${totalExpense}</p>
          <p><strong>Số dư còn lại:</strong> ${remainingBalance >= 0 ? remainingBalance : 0}</p>
          <p><strong>Chi tiết Chi Phí:</strong></p>
          ${expenseDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
          <p><strong>Chi tiết Doanh Thu:</strong></p>
          ${revenueDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
          <p><strong>Tổng Xuất kho:</strong> ${totalExport}</p>
          <p><strong>Chi tiết Xuất kho:</strong></p>
          ${exportDetails.map(detail => `<p style="margin: 0;">${detail}</p>`).join('')}
        </div>
      `;
      reportsList.innerHTML = html;
      console.log('Đã tải báo cáo tổng thành công cho', elementId, 'ngày:', selectedDate);
    }, error => {
      console.error('Lỗi tải báo cáo:', error);
      reportsList.innerHTML = '<p style="margin: 0;">Lỗi tải báo cáo: ' + error.message + '</p>';
      alert('Lỗi tải báo cáo: ' + error.message);
    });
  };

  updateReports();
  dateInput.addEventListener('change', updateReports);
  filter.addEventListener('change', updateReports);
}

function deleteReport(date, uid) {
  if (!confirm('Bạn có chắc chắn muốn xóa báo cáo này?')) return;

  db.ref(`dailyData/${date}/${uid}`).remove().then(() => {
    alert('Xóa báo cáo thành công!');
    console.log(`Đã xóa báo cáo của UID ${uid} vào ngày ${date}`);
  }).catch(error => {
    console.error('Lỗi xóa báo cáo:', error);
    alert('Lỗi xóa báo cáo: ' + error.message);
  });
}
```
