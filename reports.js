class ReportManager {
  static loadInventory(elementId, role = 'employee') {
    const container = document.getElementById(elementId);
    if (!container) return;

    db.ref('inventory').on('value', snapshot => {
      const data = snapshot.val() || {};
      let html = '<ul style="list-style:none;padding:0;">';
      Object.entries(data).forEach(([id, item]) => {
        html += `
          <li style="padding: 8px; border-bottom: 1px solid #ccc;">
            ${item.name}: ${item.quantity} ${item.unit} (Giá: ${item.price})
            ${role === 'manager' ? `
              <button onclick="InventoryManager.edit('${id}')">✏️</button>
              <button onclick="InventoryManager.delete('${id}')" style="color:red;">🗑</button>
            ` : ''}
          </li>
        `;
      });
      container.innerHTML = html + '</ul>';
    });
  }

  static loadSharedReports(elementId, role) {
    const container = document.getElementById(elementId);
    if (!container) {
      console.error(`Element ${elementId} not found`);
      return;
    }

    const datePickerId = `${role}-date-picker`;
    const datePicker = document.getElementById(datePickerId);
    if (!datePicker) {
      console.error(`Date picker ${datePickerId} not found`);
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('No current user');
      return;
    }

    const selectedDate = datePicker.value;
    const dateKey = selectedDate ? selectedDate.replace(/-/g, '_') : 
                    new Date().toLocaleDateString('vi-VN').replace(/\//g, '_');
    
    const refPath = role === 'manager' 
      ? `dailyData/${dateKey}` 
      : `dailyData/${dateKey}/${currentUser.uid}/reports`;

    db.ref(refPath).on('value', snapshot => {
      const data = snapshot.val();
      if (!data) {
        container.innerHTML = '<p>Không có báo cáo cho ngày này.</p>';
        return;
      }

      // Xử lý dữ liệu báo cáo...
      // (Giữ nguyên logic xử lý từ utils.js)
      
      container.innerHTML = this.generateReportHTML(data, role);
    }, error => {
      console.error('Lỗi tải báo cáo:', error);
      container.innerHTML = `<p>Lỗi tải báo cáo: ${error.message}</p>`;
    });
  }

  static generateReportHTML(data, role) {
    // Logic tạo HTML từ dữ liệu báo cáo
    // (Giữ nguyên logic từ utils.js)
    return `<div class="report-container">...</div>`;
  }
}

class InventoryManager {
  static add() {
    const name = document.getElementById('product-name').value.trim();
    const quantity = parseInt(document.getElementById('product-quantity').value);
    const price = parseFloat(document.getElementById('product-price').value);

    if (!name || isNaN(quantity) || isNaN(price)) {
      alert('Vui lòng nhập đúng thông tin sản phẩm.');
      return;
    }

    const productId = db.ref('inventory').push().key;
    const item = {
      name,
      quantity,
      price,
      unit: 'cái',
      timestamp: new Date().toLocaleString('vi-VN')
    };

    return db.ref('inventory/' + productId).set(item);
  }

  static edit(id) {
    db.ref('inventory/' + id).once('value').then(snapshot => {
      const data = snapshot.val();
      const newName = prompt('Tên mới:', data.name);
      const newPrice = prompt('Giá mới:', data.price);
      const newQuantity = prompt('Số lượng mới:', data.quantity);
      
      if (newName === null || newPrice === null || newQuantity === null) return;
      if (isNaN(newPrice) || isNaN(newQuantity)) {
        return alert('Giá và số lượng phải là số.');
      }

      const updates = {
        name: newName,
        price: parseFloat(newPrice),
        quantity: parseInt(newQuantity),
        timestamp: new Date().toLocaleString('vi-VN')
      };

      return db.ref('inventory/' + id).update(updates);
    });
  }

  static delete(id) {
    if (!confirm('Bạn có chắc muốn xóa sản phẩm này?')) return;
    return db.ref('inventory/' + id).remove();
  }
}
