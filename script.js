document.getElementById('zipInput').addEventListener('change', handleZipFile);

async function handleZipFile(event) {
  const zipFile = event.target.files[0];
  if (!zipFile) return;

  const zip = await JSZip.loadAsync(zipFile);
  const xmlFiles = [];

  zip.forEach((relativePath, zipEntry) => {
    if (zipEntry.name.endsWith('.xml')) {
      xmlFiles.push(zipEntry.async('text'));
    }
  });

  const contents = await Promise.all(xmlFiles);
  const output = document.getElementById('output');
  output.innerHTML = '';

  contents.forEach((xmlText, idx) => {
    const { invoiceInfo, products, totals } = parseXmlInvoice(xmlText);

    const hangHoa = products.filter(p => !p.skipWarehouse && p.category === 'hang_hoa');
    const khuyenMai = products.filter(p => p.skipWarehouse && p.category === 'KM');
    const loaiBo = products.filter(p => p.skipWarehouse && p.xmlAmount === 0);
    const chenhLech = totals.total - totals.xmlDeclared;

    const html = `
      <h2>📄 Hóa đơn #${idx + 1} – ${invoiceInfo.symbol} ${invoiceInfo.number}</h2>
      <ul>
        <li><strong>Ngày:</strong> ${invoiceInfo.date}</li>
        <li><strong>Loại:</strong> ${invoiceInfo.title}</li>
        <li><strong>Tổng (tính):</strong> ${totals.total.toLocaleString()} đ</li>
        <li><strong>Tổng (XML):</strong> ${totals.xmlDeclared.toLocaleString()} đ</li>
        <li><strong>Chênh lệch:</strong> <span class="${Math.abs(chenhLech) >= 1 ? 'warn' : 'ok'}">${chenhLech.toLocaleString()} đ</span></li>
        <li><strong>SL hàng vào kho:</strong> ${hangHoa.length}</li>
        <li><strong>SL khuyến mãi:</strong> ${khuyenMai.length}</li>
        <li><strong>SL loại bỏ:</strong> ${loaiBo.length}</li>
      </ul>
    `;

    output.innerHTML += html;
    console.log(`--- Hóa đơn #${idx + 1} ---`, invoiceInfo, totals, { hangHoa, khuyenMai, loaiBo });
  });
}

function parseXmlInvoice(xmlContent) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, "text/xml");

  const getText = (path, parent = xmlDoc) => {
    const node = parent.querySelector(path);
    return node ? node.textContent.trim() : '';
  };

  const getAdditionalInfo = (fieldName) => {
    const ttKhacNode = xmlDoc.querySelector('HDon > DLHDon > NDHDon > TToan > TTKhac');
    if (ttKhacNode) {
      const nodes = ttKhacNode.querySelectorAll('TTin');
      for (const node of nodes) {
        const field = node.querySelector('TTruong');
        if (field && field.textContent.trim() === fieldName) {
          return node.querySelector('DLieu')?.textContent.trim() || '';
        }
      }
    }
    return '';
  };

  const invoiceInfo = {
    title: getText('HDon > DLHDon > TTChung > THDon'),
    template: getText('HDon > DLHDon > TTChung > KHHDon'),
    symbol: getText('HDon > DLHDon > TTChung > KHMSHDon'),
    number: getText('HDon > DLHDon > TTChung > SHDon'),
    date: getText('HDon > DLHDon > TTChung > NLap'),
    paymentMethod: getText('HDon > DLHDon > TTChung > HTTToan'),
    paymentStatus: getAdditionalInfo('Trạng thái thanh toán'),
    amountInWords: getAdditionalInfo('TotalAmountInWordsByENG'),
    mccqt: getText('HDon > MCCQT')?.toUpperCase() || ''
  };

  const productNodes = xmlDoc.querySelectorAll('HHDVu');
  const products = [];
  let totalManual = 0;
  let totalTax = 0;

  productNodes.forEach((node, idx) => {
    const stt = getText('STT', node) || (idx + 1).toString();
    const code = getText('MHHDVu', node) || `UNKNOWN_${idx}`;
    const name = getText('THHDVu', node) || 'Không xác định';
    const unit = getText('DVTinh', node) || 'N/A';
    const quantity = parseFloat(getText('SLuong', node)) || 0;
    const price = parseFloat(getText('DGia', node)) || 0;
    const discount = parseFloat(getText('STCKhau', node)) || 0;
    const taxRate = parseFloat(getText('TSuat', node)) || 0;
    const tchat = parseInt(getText('TChat', node) || '1');
    const xmlThTien = parseFloat(getText('ThTien', node)) || 0;

    const lowerName = name.toLowerCase();
    const suspiciousKM = quantity === 0 && price > 0 && xmlThTien > 0 && (
      lowerName.includes('tặng') || lowerName.includes('khuyến mại') || lowerName.includes('km')
    );

    let category = 'hang_hoa';
    if (tchat === 3 || lowerName.includes('chiết khấu')) category = 'chiet_khau';
    else if (price === 0 || tchat === 4 || suspiciousKM) category = 'KM';

    let amount = Math.round(quantity * price - discount);
    const tax = Math.round(quantity * price * taxRate / 100);
    const diff = Math.abs(amount - Math.round(xmlThTien));

    const skipWarehouse = (quantity === 0 || xmlThTien === 0);

    if (category === 'KM' || skipWarehouse) amount = 0;

    if (!skipWarehouse && category === 'hang_hoa') {
      totalManual += amount;
      totalTax += tax;
    }

    products.push({
      stt, code, name, unit, quantity, price, discount, taxRate, amount,
      tax, xmlAmount: Math.round(xmlThTien), category, tchat,
      __diff: diff >= 1, skipWarehouse, suspiciousKM
    });
  });

  const xmlDeclared = Math.round(parseFloat(getText('HDon > DLHDon > NDHDon > TToan > TgTTTBSo') || '0'));
  const totalAmount = Math.round(totalManual + totalTax);

  return {
    invoiceInfo,
    products,
    totals: {
      beforeTax: totalManual,
      tax: totalTax,
      total: totalAmount,
      xmlDeclared,
      difference: totalAmount - xmlDeclared,
      __mismatch: Math.abs(totalAmount - xmlDeclared) >= 1
    }
  };
}