/**
 * GOOGLE APPS SCRIPT CODE TO DEPLOY:
 * 
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste the following code:
 * 
function doGet(e) {
  var action = e.parameter.action;
  var range = e.parameter.range;
  if (action === "get") {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    try {
      var sheetData = ss.getRange(range).getValues();
      return ContentService.createTextOutput(JSON.stringify({ values: sheetData })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown GET action" })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var postData = JSON.parse(e.postData.contents);
  var action = postData.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    if (action === "append") {
      var range = postData.range;
      var values = postData.values;
      var sheetName = range.split("!")[0].replace(/'/g, "");
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      sheet.getRange(sheet.getLastRow() + 1, 1, values.length, values[0].length).setValues(values);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "update") {
      var range = postData.range;
      var values = postData.values;
      var sheetName = range.split("!")[0].replace(/'/g, "");
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ error: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      var gridRange = sheet.getRange(range.split("!")[1]);
      gridRange.setValues(values);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
    
    if (action === "init") {
      var sheetsToCreate = [
        { title: 'MASTER_PRODUK', headers: ['Kode Produk', 'Nama Produk', 'Satuan', 'Kategori'] },
        { title: 'MASTER_LOCATOR', headers: ['WH Group', 'Nama Locator', 'Deskripsi', 'WH Type', 'Area'] },
        { title: 'INPUT', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
        { title: 'INPUT RM', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
        { title: 'INPUT MFG', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
        { title: 'INPUT SUPPLIES', headers: ['Tanggal', 'Nama Bahan', 'Qty', 'UOM', 'I/O/A', 'Locator', 'Locator To', 'No. Document', 'Keterangan', 'Kode'] },
      ];
      
      sheetsToCreate.forEach(function(s) {
        var sheet = ss.getSheetByName(s.title);
        if (!sheet) {
          sheet = ss.insertSheet(s.title);
          sheet.getRange(1, 1, 1, s.headers.length).setValues([s.headers]);
        }
      });
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(JSON.stringify({ error: "Unknown POST action" })).setMimeType(ContentService.MimeType.JSON);
}
 * 
 * 4. Click Deploy -> New deployment
 * 5. Select type: Web App
 * 6. Execute as: Me
 * 7. Who has access: Anyone
 * 8. Click Deploy and copy the Web App URL.
 */

export async function fetchSheetData(gasUrl: string, range: string) {
  const url = `${gasUrl}?action=get&range=${encodeURIComponent(range)}&t=${Date.now()}`;
  
  // App Script redirects, so we use GET and it handles the rest
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch sheet data. Check App Script URL.`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return data.values || [];
}

export async function appendSheetRow(gasUrl: string, range: string, values: any[][]) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'append', range, values })
  });
  
  if (!res.ok) throw new Error(`Failed to append data.`);
  
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  
  return data;
}

export async function updateSheetRow(gasUrl: string, range: string, values: any[][]) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'update', range, values })
  });
  
  if (!res.ok) throw new Error(`Failed to update data.`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);

  return data;
}

/** Check if the necessary sheets exist, if not create them */
export async function initializeERPSpreadsheet(gasUrl: string) {
  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'init' })
  });
  
  if (!res.ok) throw new Error(`Failed to initialize data.`);

  const data = await res.json();
  if (data.error) throw new Error(data.error);
}
