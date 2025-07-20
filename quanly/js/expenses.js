import { db, auth } from './auth.js';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, Timestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function initExpenses() {
  let expenseCategories = [];

  function parseExpenseInput(input) {
    const normalized = input.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s]/g, "");
    const amountMatch = normalized.match(/(\d+)\s*$/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : 0;
    let description = normalized;
    if (amountMatch) description = normalized.substring(0, amountMatch.index).trim();
    const categoryMatch = description.match(/^\s*(\S+)/);
    const category = categoryMatch ? categoryMatch[1] : 'khác';
    
    if (!expenseCategories.includes(category)) {
      expenseCategories.push(category);
      addDoc(collection(db, 'expenseCategories'), { category });
    }
    
    return {
      description: capitalizeFirstLetter(description),
      amount,
      category: capitalizeFirstLetter(category)
    };
  }

  function capitalizeFirstLetter(string) {
    return string.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  document.getElementById('add-expense').addEventListener('click', async () => {
    const input = document.getElementById('expenseInput').value.trim();
    const errorContainer = document.getElementById('errorContainer');
    if (!input) {
      errorContainer.innerHTML = '<div class="error-message">Vui lòng nhập thông tin chi phí</div>';
      return;
    }

    const { description, amount, category } = parseExpenseInput(input);
    if (!description || amount <= 0) {
      errorContainer.innerHTML = '<div class="error-message">Không thể xác định mô tả hoặc số tiền</div>';
      return;
    }

    try {
      await addDoc(collection(db, 'expenses'), {
        description,
        amount,
        category,
        user: auth.currentUser.uid,
        timestamp: Timestamp.now()
      });
      document.getElementById('expenseInput').value = '';
    } catch (error) {
      errorContainer.innerHTML = `<div class="error-message">Lỗi: ${error.message}</div>`;
    }
  });

  document.getElementById('expenseInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('add-expense').click();
  });

  onSnapshot(collection(db, 'expenseCategories'), (snapshot) => {
    expenseCategories = snapshot.docs.map(doc => doc.data().category);
  });

  onSnapshot(query(collection(db, 'expenses'), orderBy('timestamp', 'desc')), (snapshot) => {
    const table = document.querySelector('#expenseTable tbody');
    table.innerHTML = '';
    snapshot.forEach((doc) => {
      const data = doc.data();
      const row = `<tr>
        <td>${data.description} <span class="category-badge">${data.category}</span></td>
        <td class="text-right">${data.amount.toLocaleString('vi-VN')}₫</td>
        <td class="actions manager-only"><button class="danger" onclick="window.deleteDoc('expenses', '${doc.id}')">Xóa</button></td>
      </tr>`;
      table.innerHTML += row;
    });
  });
}
