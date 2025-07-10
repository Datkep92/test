// script.js

let businesses = []; // Danh sách HKD
let invoices = []; // Danh sách hóa đơn

const DEFAULT_BUSINESS_ID = "DEFAULT_HKD";
const DEFAULT_BUSINESS_NAME = "Chưa xác định";

window.addEventListener('DOMContentLoaded', () => {
  const pdfInput = document.getElementById('pdfInput');
  if (pdfInput) {
    pdfInput.addEventListener('change', handleZipInput);
  }
});

async function handleZipInput(e) {
  const files = e.target.files;
  const status = document.getElementById('status');

  for (const file of files) {
    if (!file.name.endsWith('.zip')) continue;

    const zip = await JSZip.loadAsync(file);

    for (const [name, zipEntry] of Object.entries(zip.files)) {
      if (!name.endsWith('.html')) continue;
      const html = await zipEntry.async('string');
      const invoice = parseInvoiceFromHTML(html);

      const isDuplicate = invoices.some(i => i.mccqt === invoice.mccqt && i.so === invoice.so);
      if (isDuplicate) continue;

      let business = businesses.find(b => b.taxCode === invoice.mstMua);
      if (!business) {
        business = {
          id: crypto.randomUUID(),
          name: invoice.tenMua,
          taxCode: invoice.mstMua,
          address: invoice.diachiMua,
          invoices: [],
          inventory: []
        };
        businesses.push(business);
      }

      business.invoices.push(invoice);
      business.inventory.push(...invoice.items);
      invoices.push(invoice);
    }
  }

  updateBusinessList();
  if (status) status.innerText = "✅ Đã xử lý xong ZIP!";
}

function parseInvoiceFromHTML(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const get = sel => (doc.querySelector(sel)?.textContent.trim() || 'Không rõ');

  const invoice = {
    so: get('.code-content b:nth-child(3)'),
    kyhieu: get('.code-content b:nth-child(2)'),
    date: get('p.day'),
    mccqt: get('li:nth-child(2) .di-value div'),
    tenMua: get('li:nth-child(9) .di-value div'),
    mstMua: get('li:nth-child(11) .di-value div'),
    diachiMua: get('li:nth-child(13) .di-value div'),
    items: [],
    totalAmount: 0
  };

  const table = doc.querySelector('table.res-tb');
  if (table) {
    for (const row of table.querySelectorAll('tbody tr')) {
      const tds = row.querySelectorAll('td');
      if (tds.length < 10) continue;
      const item = {
        type: tds[1].textContent.trim(),
        name: tds[3].textContent.trim(),
        unit: tds[4].textContent.trim(),
        qty: parseFloat(tds[5].textContent.replace(/,/g, '')) || 0,
        price: parseFloat(tds[6].textContent.replace(/,/g, '')) || 0,
        vat: tds[8].textContent.trim(),
        total: parseFloat(tds[9].textContent.replace(/,/g, '')) || 0
      };
      invoice.items.push(item);
      invoice.totalAmount += item.total;
    }
  }
  return invoice;
}

function updateBusinessList() {
  const list = document.getElementById('businessList');
  if (!list) return;
  list.innerHTML = '';

  businesses.forEach(b => {
    const div = document.createElement('div');
    div.className = 'business-entry';
    div.textContent = `${b.name} (${b.taxCode})`;
    div.onclick = () => showBusinessDetails(b.id);
    list.appendChild(div);
  });
}

function showBusinessDetails(businessId) {
  const b = businesses.find(x => x.id === businessId);
  if (!b) return;

  updateSelectedBusinessId(businessId);

  const invoiceTable = document.getElementById('invoiceTable').querySelector('tbody');
  const headerRow = document.getElementById('headerRow');
  const invoiceInfo = document.getElementById('invoiceInfo');

  if (!invoiceTable || !headerRow || !invoiceInfo) return;

  invoiceTable.innerHTML = '';
  headerRow.innerHTML = '<th>STT</th><th>Tên hàng hóa</th><th>Đơn vị</th><th>Số lượng</th><th>Đơn giá</th><th>Thuế suất</th><th>Thành tiền</th>';

  const grouped = {};
  for (const item of b.inventory) {
    const key = `${item.name}__${item.unit}`;
    if (!grouped[key]) {
      grouped[key] = { ...item };
    } else {
      grouped[key].qty += item.qty;
      grouped[key].total += item.total;
    }
  }
  const mergedItems = Object.values(grouped);

  mergedItems.forEach((item, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td contenteditable>${item.name}</td>
      <td contenteditable>${item.unit}</td>
      <td contenteditable>${item.qty}</td>
      <td contenteditable>${item.price}</td>
      <td contenteditable>${item.vat}</td>
      <td>${item.total.toLocaleString()}</td>
    `;
    invoiceTable.appendChild(tr);
  });

  const total = mergedItems.reduce((sum, i) => sum + i.total, 0);
  document.getElementById('autoInvoiceTotal').textContent = `Tổng tiền: ${total.toLocaleString()} VND`;
  invoiceInfo.textContent = `📋 Hộ kinh doanh: ${b.name} - MST: ${b.taxCode}`;
}

function addManualInventoryItem() {
  const tbody = document.getElementById('manualInventoryItemsBody');
  const row = document.createElement('tr');
  row.innerHTML = `
    <td contenteditable>SP mới</td>
    <td contenteditable>ĐVT</td>
    <td contenteditable>0</td>
    <td contenteditable>0</td>
    <td contenteditable>8%</td>
    <td>0</td>
    <td><button onclick="this.closest('tr').remove()">🗑️</button></td>
  `;
  tbody.appendChild(row);
}

function saveManualInventory() {
  alert("💾 Lưu tồn kho thủ công chưa được triển khai.");
}

function hideManualInventoryForm() {
  document.getElementById('manualInventoryForm').classList.add('hidden');
}
