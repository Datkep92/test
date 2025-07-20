import { db, auth } from './auth.js';
import { collection, addDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function initRevenues() {
  function parseNumber(input) {
    if (!input) return 0;
    const cleaned = input.toString().replace(/[^\d]/g, '');
    return parseInt(cleaned) || 0;
  }

  document.getElementById('add-revenue').addEventListener('click', async () => {
    const amount = parseNumber(document.getElementById('revenueAmount').value);
    if (isNaN(amount) || amount <= 0) {
      document.getElementById('errorContainer').innerHTML = '<div class="error-message">Vui lòng nhập số tiền hợp lệ</div>';
      return;
    }

    try {
      await addDoc(collection(db, 'revenues'), {
        amount,
        user: auth.currentUser.uid,
        timestamp: Timestamp.now()
      });
      document.getElementById('revenueAmount').value = '';
    } catch (error) {
      document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  });

  document.getElementById('revenueAmount').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('add-revenue').click();
  });
}