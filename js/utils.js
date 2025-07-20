import { db } from './auth.js';
import { doc, getDoc, updateDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export async function deleteDoc(collectionName, docId) {
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    document.getElementById('errorContainer').innerHTML = `<div class="error-message">Lỗi: ${error.message}</div>`;
  }
}

export async function editProduct(docId) {
  try {
    const productRef = doc(db, 'products', docId);
    const productSnap = await getDoc(productRef);
    if (!productSnap.exists()) throw new Error('Sản phẩm không tồn tại');
    const product = productSnap.data();
    const newName = prompt('Tên sản phẩm:', product.name);
    if (!newName) return;
    const newQuantity = parseInt(prompt('Số lượng:', product.quantity)) || 0;
    if (isNaN(newQuantity)) throw new Error('Số lượng không hợp lệ');
    const newUnit = prompt('Đơn vị tính:', product.unit);
    if (!newUnit) return;
    const newPrice = parseInt(prompt('Giá đơn vị:', product.price)) || 0;
    if (isNaN(newPrice)) throw new Error('Giá không hợp lệ');
    await updateDoc(productRef, { name: newName, quantity: newQuantity, unit: newUnit, price: newPrice });
  } catch (error) {
    document.getElementById('inventoryErrorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
  }
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
    document.getElementById('exportErrorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
  }
}

export async function toggleUserStatus(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) throw new Error('Người dùng không tồn tại');
    await updateDoc(userRef, { active: !userSnap.data().active });
  } catch (error) {
    document.getElementById('userErrorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
  }
}

export async function deleteUser(userId) {
  if ((await getDoc(doc(db, 'users', userId))).data().username === 'admin') {
    document.getElementById('userErrorContainer').innerHTML = '<div class="error-message">Không thể xóa tài khoản admin</div>';
    return;
  }
  if (confirm('Bạn có chắc muốn xóa tài khoản này?')) {
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (error) {
      document.getElementById('userErrorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  }
}
