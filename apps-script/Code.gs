/**
 * Parakh — Sign-up data → Google Sheet
 *
 * Setup:
 * 1. Create a new Google Sheet (https://sheets.new)
 * 2. Rename the first sheet/tab to "Signups"
 * 3. Add headers in row 1:  Timestamp | Name | Country code | Phone | Dial code | User-Agent
 * 4. Extensions → Apps Script. Replace the default code with this file.
 * 5. Click Deploy → New deployment → Type: Web app
 *      - Description: Parakh signup endpoint
 *      - Execute as: Me
 *      - Who has access: Anyone
 *    Click Deploy. Copy the Web app URL.
 * 6. In Parakh Mobile.html, add this line in <head>:
 *      <script>window.PARAKH_SHEET_URL = 'PASTE_THE_URL_HERE';</script>
 * 7. Commit + push. Done.
 */

const SHEET_NAME = 'Signups';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(['Timestamp', 'Name', 'Country', 'Phone', 'Dial code', 'User-Agent']);
    }
    sheet.appendRow([
      new Date(),
      String(data.name || '').trim(),
      String(data.country || '').trim(),
      String(data.phone || '').replace(/\D/g, ''),
      String(data.dial || '').trim(),
      String(data.userAgent || '').slice(0, 200),
    ]);
    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Optional: GET endpoint for sanity check (open the Web app URL in a browser)
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, message: 'Parakh signup endpoint live' }))
    .setMimeType(ContentService.MimeType.JSON);
}
