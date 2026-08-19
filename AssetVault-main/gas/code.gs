/**
 * AMS — Sheet setup (field mapping = server/sheetHeaders.ts)
 *
 * NEW spreadsheet par:
 *   1) Is script ko Apps Script project me rakho (WebApp.gs ke saath)
 *   2) Run > main   YA   menu AMS > Setup All Sheets
 *   3) Deploy Web App (WebApp.gs doGet/doPost)
 *
 * setupSheets() — saari tabs correct column headers ke saath banata hai.
 */

// --- Canonical headers (must match server/sheetHeaders.ts) ---

var SETUP_CATEGORIES_ = [
  "IT Assets",
  "Office Assets",
  "Electrical Assets",
  "Production Assets",
  "Safety Assets",
  "Vehicle Assets",
  "Furniture Assets",
  "Software License Assets",
  "Admin Facility Assets",
  "Maintenance Assets"
];

var SETUP_CATEGORY_HEADERS_ = [
  "Asset ID", "Asset Code", "Account Asset Code", "Asset Name", "Main Category", "Sub Category", "Asset Type",
  "Brand", "Model", "Serial Number", "Quantity", "Plant Name",
  "Location", "Department", "Assigned To", "Employee ID", "Assigned Date", "Purchase Date",
  "Purchase Cost", "Vendor Name", "Invoice Number", "Warranty Start Date", "Warranty Expiry Date",
  "Condition", "Status", "Maintenance Required", "Last Maintenance Date", "Next Maintenance Date",
  "AMC Vendor", "AMC Start Date", "AMC End Date", "AMC Cost",
  "Photo URL / Photo Upload", "Document URL / Attached Documents", "QR Code / Barcode", "Remarks",
  "Created By", "Created Date", "Updated By", "Updated Date",
  "Contact Email", "Contact Number"
];

var SETUP_IT_EXTRA_HEADERS_ = [
  "RAM", "SSD", "CPU", "Windows Version", "MAC Address", "IP Address", "Host Name", "Unique Code", "Binary Code",
  "Monitor Serial", "Monitor Asset Code", "Monitor Brand", "Monitor Model Number",
  "Keyboard Serial", "Keyboard Asset Code", "Keyboard Brand", "Keyboard Model Number", "Keyboard Connectivity",
  "Mouse Serial", "Mouse Asset Code", "Mouse Brand", "Mouse Model Number", "Mouse Connectivity",
  "UPS Serial", "UPS Asset Code", "UPS Brand", "UPS Model Number"
];

function setupStyleHeaderRow_(sh, colCount, bg, fg) {
  if (!sh || colCount < 1) return;
  var hr = sh.getRange(1, 1, 1, colCount);
  hr.setBackground(bg || "#1a73e8");
  hr.setFontColor(fg || "#ffffff");
  hr.setFontWeight("bold");
  sh.setFrozenRows(1);
}

function setupGetOrCreateSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function setupWriteHeaders_(sh, headers, bg) {
  sh.clear();
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  setupStyleHeaderRow_(sh, headers.length, bg);
}

function setupFixHeaders_(sh, targetHeaders, bg) {
  var lastCol = Math.max(sh.getLastColumn(), targetHeaders.length);
  if (lastCol === 0) {
    setupWriteHeaders_(sh, targetHeaders, bg);
    return;
  }
  var current = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var missing = [];
  for (var i = 0; i < targetHeaders.length; i++) {
    if (current.indexOf(targetHeaders[i]) === -1) missing.push(targetHeaders[i]);
  }
  if (missing.length > 0) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
  setupStyleHeaderRow_(sh, sh.getLastColumn(), bg);
}

/**
 * setupSheets — Run once on a NEW spreadsheet.
 * Creates all AMS tabs with correct field column order (header row only, no data rows).
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var itHeaders = SETUP_CATEGORY_HEADERS_.concat(SETUP_IT_EXTRA_HEADERS_);
  var assetHeaders = SETUP_CATEGORY_HEADERS_.slice();
  var created = [];

  for (var c = 0; c < SETUP_CATEGORIES_.length; c++) {
    var cat = SETUP_CATEGORIES_[c];
    var headers = cat === "IT Assets" ? itHeaders : assetHeaders;
    var sh = setupGetOrCreateSheet_(ss, cat);
    setupWriteHeaders_(sh, headers, "#1a73e8");
    created.push(cat);
  }

  var usersSh = setupGetOrCreateSheet_(ss, "Users");
  setupWriteHeaders_(usersSh, [
    "Email", "Role", "Locations", "Plants", "Categories"
  ], "#4338ca");

  var otpLogSh = setupGetOrCreateSheet_(ss, "OTP_Log");
  setupWriteHeaders_(otpLogSh, [
    "Email", "OTP", "Expiry", "Attempts", "Requested At", "Status"
  ], "#b45309");

  var locSh = setupGetOrCreateSheet_(ss, "Locations");
  setupWriteHeaders_(locSh, ["Location Name", "Department", "Created Date"], "#0f766e");

  var plantSh = setupGetOrCreateSheet_(ss, "Plants");
  setupWriteHeaders_(plantSh, ["Plant Code", "Plant Name", "Location Name", "Created Date"], "#0f766e");

  var optionsSh = setupGetOrCreateSheet_(ss, "Options");
  setupWriteHeaders_(optionsSh, ["Type", "Value"], "#64748b");

  var meta = [
    ["Asset_Details", ["Asset ID", "Field Key", "Field Value", "Updated At"], "#475569"],
    ["Category_Definitions", ["Type ID", "Config JSON"], "#475569"],
    ["Employees", [
      "Employee ID", "Name", "Email", "Phone", "Department", "Location",
      "Designation", "Plant Code", "Status", "Created Date", "Updated Date"
    ], "#475569"],
    ["Assignment_History", [
      "Record ID", "Asset ID", "Action", "Employee ID", "Employee Name",
      "Assigned Date", "Returned Date", "Assigned By", "Remarks", "From Employee ID", "From Employee Name"
    ], "#475569"],
    ["Inventory", [
      "Item ID", "Asset Code", "Item Name", "Brand Name", "Model", "Serial Number",
      "Category", "Status", "Quantity", "Min Stock",
      "Employee ID", "Assignee Name", "Assignee Email", "Contact Number", "Updated Date"
    ], "#475569"],
    ["Damaged_Items", [
      "Record ID", "Asset ID", "Asset Name", "Damage Date", "Damage Reason", "Reported By",
      "Repair Required", "Estimated Cost", "Status", "Remarks", "Photo URL"
    ], "#dc2626"],
    ["Missing_Items", [
      "Record ID", "Parent Asset ID", "Parent Asset Name", "Missing Item Name", "Asset Type",
      "Brand", "Model", "Employee ID", "Assigned Person", "Missing Date", "Status",
      "Remarks", "Recovered Date", "Recovered By"
    ], "#d97706"],
    ["Audit_Logs", [
      "Log ID", "User Email", "Action", "Target ID", "Date & Time", "Old Value", "New Value", "Remarks"
    ], "#475569"],
    ["Categories", ["Category Name", "Description", "Created Date"], "#6366f1"],
    ["Asset_Types", ["Type ID", "Type Name", "Main Category", "Config JSON"], "#6366f1"],
    ["Asset_Extra_Items", [
      "Record ID", "Parent Asset ID", "Item Name", "Quantity", "Serial Number",
      "Condition", "Status", "Remarks", "Updated Date"
    ], "#6366f1"],
    ["Assignments", [
      "Assignment ID", "Asset/Inventory ID", "Type", "Assignee Name", "Assignee ID",
      "Department", "Contact Number", "Assigned Date", "Assigned By", "Status", "Remarks"
    ], "#6366f1"],
    ["Assets", itHeaders, "#1a73e8"]
  ];

  for (var m = 0; m < meta.length; m++) {
    var mSh = setupGetOrCreateSheet_(ss, meta[m][0]);
    setupWriteHeaders_(mSh, meta[m][1], meta[m][2]);
    created.push(meta[m][0]);
  }

  setupSeedDefaults_(ss);

  var msg = "AEMS setup complete.\n\nTabs ready (" + created.length + "):\n" +
    SETUP_CATEGORIES_.join(", ") +
    "\n\nIT Assets = 59 columns (with Assigned Date + IT specs).\n" +
    "Other categories = 42 columns.\n\nDefault IT Admin: admin@example.com (Users tab)\n" +
    "Locations: Head Office, Bhiwadi Plant";

  try {
    SpreadsheetApp.getUi().alert(msg);
  } catch (e) {
    Logger.log(msg);
  }
  return msg;
}

function setupSeedDefaults_(ss) {
  var now = new Date().toISOString();

  var locSh = ss.getSheetByName("Locations");
  if (locSh && locSh.getLastRow() === 1) {
    locSh.appendRow(["Head Office", "IT", now]);
    locSh.appendRow(["Bhiwadi Plant", "Manufacturing", now]);
  }

  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() === 1) {
    plantSh.appendRow(["HO-01", "Corporate HQ", "Head Office", now]);
    plantSh.appendRow(["BHW-01", "Production Plant 1", "Bhiwadi Plant", now]);
  }

  var usersSh = ss.getSheetByName("Users");
  if (usersSh && usersSh.getLastRow() === 1) {
    usersSh.appendRow(["admin@example.com", "IT Admin", "All", "All", "All", "", "", 0]);
  }
}

/** Apps Script editor: Run > main */
function main() {
  setupSheets();
}

/** Menu is defined in WebApp.gs (onOpen + buildAemsMenu_). Run buildAemsMenu_ if menu missing. */
