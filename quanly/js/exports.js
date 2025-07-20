import { db, auth } from './auth.js';
import { collection, doc, runTransaction, onSnapshot, query, orderBy, Timestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

let selectedProduct = null;

export function initExports() {
  function renderProductSelection() {
    const container = document.getElementById('productList');
    container.innerHTML = '';
    onSnapshot(collection(db, 'products'), (snapshot) => {
      snapshot.forEach((doc) => {
        const product = doc.data();
        const productItem = document.createElement('div');
        productItem.className = 'product-item';
        productItem.innerHTML = `
          <div><strong>${product.name}</strong></div>
          <div>Tồn kho: ${product.quantity} ${product.unit}</div>
        `;
        productItem.addEventListener('click', () => {
          document.querySelectorAll('.product-item').forEach(item => item.classList.remove('selected'));
          productItem.classList.add('selected');
          selectedProduct = { id: doc.id, ...product };
        });
        container.appendChild(productItem);
      });
    });
  }

  document.getElementById('add-export').addEventListener('click', async () => {
    if (!selectedProduct) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Vui lòng chọn sản phẩm</div>';
      return;
    }

    const quantity = parseInt(document.getElementById('exportQuantity').value) || 1;
    if (quantity <= 0) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Số lượng phải lớn hơn 0</div>';
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const productRef = doc(db, 'products', selectedProduct.id);
        const docSnap = await transaction.get(productRef);
        if (!docSnap.exists()) throw new Error('Sản phẩm không tồn tại');
        const newQuantity = docSnap.data().quantity - quantity;
        if (newQuantity < 0) throw new Error(`Số lượng tồn kho không đủ (${docSnap.data().quantity} ${docSnap.data().unit})`);
        transaction.update(productRef, { quantity: newQuantity });
        transaction.set(doc(collection(db, 'exports')), {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          quantity,
          unit: selectedProduct.unit,
          price: selectedProduct.price,
          user: auth.currentUser.uid,
          timestamp: Timestamp.now()
        });
      });
      document.getElementById('exportQuantity').value = '1';
      selectedProduct = null;
      document.querySelectorAll('.product-item').forEach(item => item.classList.remove('selected'));
    } catch (error) {
      document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  });

  document.getElementById('exportQuantity').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('add-export').click();
  });

  onSnapshot(query(collection(db, 'exports'), orderBy('timestamp', 'desc')), (snapshot) => {
    const table = document.querySelector('#exportTable tbody');
    table.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const row = `<tr>
        <td>${data.productName}</td>
        <td>${data.quantity}</td>
        <td>${data.unit}</td>
        <td class="actions manager-only"><button class="danger" onclick="deleteExport('${doc.id}')">Xóa</button></td>
      </tr>`;
      table.innerHTML += row;
    });
  });

  renderProductSelection();
}

export async function deleteExport(docId) {
  try {
    await runTransaction(db, async (transaction) => {
      const exportRef = doc(db, 'exports', docId);
      const exportSnap = await transaction.get(exportRef);
      if (!exportSnap.exists()) throw new Error('Mục xuất hàng không tồn tại');
      const productRef = doc(db, 'products', exportSnap.data().productId);
      const productSnap = await transaction.get(productRef);
      if (!productSnap.exists()) throw new Error('Sản phẩm không tồn tại');
      const newQuantity = productSnap.data().quantity + exportSnap.data().quantity;
      transaction.update(productRef, { quantity: newQuantity });
      transaction.delete(exportRef);
    });
  } catch (error) {
    document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
  }
}