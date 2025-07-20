import { db, auth } from './auth.js';
import { collection, query, where, getDocs, addDoc, Timestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function initDailySummary() {
  async function renderDailyData() {
    const today = new Date().toLocaleDateString('vi-VN');
    document.getElementById('summaryDate').textContent = today;
    const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999));

    let totalRevenue = 0;
    let totalExpense = 0;
    let totalExportCost = 0;

    const revenueSnapshot = await getDocs(query(
      collection(db, 'revenues'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay))
    ));
    revenueSnapshot.forEach(doc => totalRevenue += doc.data().amount);

    const expenseSnapshot = await getDocs(query(
      collection(db, 'expenses'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay))
    ));
    expenseSnapshot.forEach(doc => totalExpense += doc.data().amount);

    const exportSnapshot = await getDocs(query(
      collection(db, 'exports'),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay))
    ));
    exportSnapshot.forEach(doc => totalExportCost += doc.data().quantity * doc.data().price);

    document.getElementById('totalRevenue').textContent = totalRevenue.toLocaleString('vi-VN') + '₫';
    document.getElementById('totalExpense').textContent = totalExpense.toLocaleString('vi-VN') + '₫';
    document.getElementById('dailyBalance').innerHTML = `<strong>${(totalRevenue - totalExpense).toLocaleString('vi-VN')}₫</strong>`;

    const exportSummary = document.getElementById('exportSummary');
    exportSummary.innerHTML = '';
    if (exportSnapshot.size > 0) {
      const summaryDiv = document.createElement('div');
      summaryDiv.style.marginTop = '15px';
      summaryDiv.innerHTML = `
        <h4>Xuất hàng hôm nay:</h4>
        <ul>
          ${exportSnapshot.docs.map(doc => `<li>${doc.data().productName}: ${doc.data().quantity} ${doc.data().unit}</li>`).join('')}
        </ul>
      `;
      exportSummary.appendChild(summaryDiv);
    }

    const noteSnapshot = await getDocs(query(
      collection(db, 'dailyNotes'),
      where('user', '==', auth.currentUser.uid),
      where('timestamp', '>=', Timestamp.fromDate(startOfDay)),
      where('timestamp', '<=', Timestamp.fromDate(endOfDay))
    ));
    if (!noteSnapshot.empty) {
      document.getElementById('dailyNote').value = noteSnapshot.docs[0].data().note;
    }
  }

  document.getElementById('save-daily').addEventListener('click', async () => {
    const note = document.getElementById('dailyNote').value;
    const today = new Date().toLocaleDateString('vi-VN');
    try {
      await addDoc(collection(db, 'dailyNotes'), {
        note,
        user: auth.currentUser.uid,
        timestamp: Timestamp.now(),
        date: today
      });
      alert('Đã lưu dữ liệu ngày ' + today);
    } catch (error) {
      document.getElementById('errorContainer').innerHTML = `<div class="error-message">${error.message}</div>`;
    }
  });

  renderDailyData();
}