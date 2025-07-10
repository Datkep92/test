// hkd-manager.js

const businesses = {}; // MST => { ten, mst, invoices: [], stock: [] }
const allInvoices = []; // Danh sách tất cả hóa đơn đã xử lý

function parseInvoiceHTML(html) {
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const get = sel => (dom.querySelector(sel)?.textContent.trim() || '');
  const invoice = {
    so: get(".code-content b:nth-child(3)"),
    kyHieu: get(".code-content b:nth-child(2)"),
    ngay: get("p.day"),
    mccqt: get("li:nth-child(2) .di-value div"),
    tenMua: get("li:nth-child(9) .di-value div"),
    mstMua: get("li:nth-child(11) .di-value div"),
    items: [],
    total: 0
  };

  const table = dom.querySelector('table.res-tb');
  if (table) {
    for (const row of table.querySelectorAll('tbody tr')) {
      const cells = [...row.querySelectorAll('td')].map(td => td.textContent.trim());
      if (cells.length >= 10) {
        const sl = parseFloat(cells[5].replace(/,/g, '')) || 0;
        const dg = parseFloat(cells[6].replace(/,/g, '')) || 0;
        const tt = parseFloat(cells[9].replace(/,/g, '')) || 0;
        invoice.items.push({ ten: cells[3], dvt: cells[4], sl, dg, tt });
        invoice.total += tt;
      }
    }
  }
  return invoice;
}

async function processZipFiles(files, statusCallback) {
  const JSZipLib = window.JSZip;
  for (const file of files) {
    if (!file.name.endsWith('.zip')) continue;
    const zip = await JSZipLib.loadAsync(file);

    for (const [filename, fileObj] of Object.entries(zip.files)) {
      if (!filename.endsWith('.html')) continue;
      const html = await fileObj.async('string');
      const invoice = parseInvoiceHTML(html);
      if (!invoice.mstMua || !invoice.mccqt) continue;

      const mccqtKey = `${invoice.mccqt}-${invoice.so}`;
      if (allInvoices.some(i => `${i.mccqt}-${i.so}` === mccqtKey)) {
        console.warn('⚠️ MCCQT trùng:', mccqtKey);
        continue;
      }

      allInvoices.push(invoice);

      const mst = invoice.mstMua;
      if (!businesses[mst]) businesses[mst] = { ten: invoice.tenMua, mst, invoices: [], stock: [] };
      businesses[mst].invoices.push(invoice);
      businesses[mst].stock.push(...invoice.items);
    }
  }
  statusCallback('✅ Xử lý xong tất cả file.');
}

function getHKDList() {
  return Object.values(businesses);
}

function deleteHKD(mst) {
  if (businesses[mst]) {
    delete businesses[mst];
    return true;
  }
  return false;
}

function searchHKD(keyword) {
  return getHKDList().filter(hkd => hkd.mst.includes(keyword) || hkd.ten.toLowerCase().includes(keyword.toLowerCase()));
}

function getStockTable(mst) {
  if (!businesses[mst]) return [];
  return businesses[mst].stock.map((item, idx) => ({
    stt: idx + 1,
    ...item,
    thanhTien: item.sl * item.dg
  }));
}
