import { db } from './auth.js';
import { collection, doc, setDoc, updateDoc, onSnapshot, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function initInventory() {
  document.getElementById('add-product').addEventListener('click', async () => {
    const name = document.getElementById('productName').value.trim();
    const quantity = parseInt(document.getElementById('productQuantity').value) || 0;
    const unit = document.getElementById('productUnit').value.trim();
    const price = parseInt(document.getElementById('productPrice').value) || 0;

    if (!name || !unit || isNaN(quantity) || isNaN(price)) {
      document.getElementById('inventoryErrorContainer').innerHTML = '<div class="error-message">Vui lòng nhập đầy đủ thông tin sản phẩm</div>';
      return;
    }

    try {
      await setDoc(doc(db, 'products', Date.now().toString()), {
        name,
        quantity,
        unit,
        price
      });
      document.getElementById('productName').value = '';
      document.getElementById('productQuantity').value = '';
      document.getElementById('productUnit').value = '';
      document.getElementById('productPrice').value = '';
    } catch (error) {
      document.getElementById('inventoryErrorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  });

  onSnapshot(collection(db, 'products'), (snapshot) => {
    const table = document.querySelector('#productTable tbody');
    table.innerHTML = '';
    snapshot.forEach((doc) => {
      const product = doc.data();
      const row = `<tr>
        <td>${product.name}</td>
        <td>${product.quantity}</td>
        <td>${product.unit}</td>
        <td class="text-right">${product.price.toLocaleString('vi-VN')}₫</td>
        <td class="actions manager-only">
          <button onclick="window.editProduct('${doc.id}')">Sửa</button>
          <button class="danger" onclick="window.deleteDoc('products', '${doc.id}')">Xóa</button>
        </td>
      </tr>`;
      table.innerHTML += row;
    });
  });
}
