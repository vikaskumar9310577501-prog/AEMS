// yeh hai copy wala
/**
 * Asset Entry Management system — Clean Google Apps Script backend (v2)
 * Deploy: Execute as Me | Who has access: Anyone
 *
 * NO auto-setup / migrate — create tabs manually (see NEW_SHEET_ROW1_HEADERS.txt).
 * All asset read/write uses HEADER NAME mapping (never blind column index).
 *
 * Spreadsheet: 1AZJTjLCviNobGM2f4-6ekDZyVW09XS0jIN4xPvzR2Tk
 * Users tab gid: update after setupSheets (open Users tab → copy #gid= from URL)
 */
var USERS_SHEET_GID = 0; // ignored when Users tab exists — sheet name "Users" is used first
var OTP_TTL_MS = 10 * 60 * 1000;
var MAX_OTP_ATTEMPTS = 5;
var SENDER_EMAIL = "verify.software2040@pgel.in";
var SENDER_NAME = "PG GROUP SOFTWARE SYSTEM";
var APP_DISPLAY_NAME = "Asset Entry Management system";
var APP_SHORT_NAME = "AEMS";
var OTP_LOG_SHEET_NAME = "OTP_Log";
var OTP_LOG_HEADERS_ = ["Email", "OTP", "Expiry", "Attempts", "Requested At", "Status"];

var CATEGORIES = [
  "IT Assets", "Office Assets", "Electrical Assets", "Production Assets",
  "Safety Assets", "Vehicle Assets", "Furniture Assets",
  "Software License Assets", "Admin Facility Assets", "Maintenance Assets"
];

var CATEGORY_HEADERS = [
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

var IT_EXTRA_HEADERS = [
  "RAM", "SSD", "CPU", "Windows Version", "MAC Address", "IP Address", "Host Name", "Unique Code", "Binary Code",
  "Monitor Serial", "Monitor Asset Code", "Keyboard Serial", "Keyboard Asset Code",
  "Mouse Serial", "Mouse Asset Code", "UPS Serial", "UPS Asset Code"
];

var CATEGORY_SHEET_MAP_ = {
  "IT Assets": "IT Assets", "Office Assets": "Office Assets", "Electrical Assets": "Electrical Assets",
  "Production Assets": "Production Assets", "Production / Manufacturing Assets": "Production Assets",
  "Safety Assets": "Safety Assets", "Vehicle Assets": "Vehicle Assets", "Furniture Assets": "Furniture Assets",
  "Software / License Assets": "Software License Assets", "Admin / Facility Assets": "Admin Facility Assets",
  "Maintenance Assets": "Maintenance Assets", "Maintenance Tools": "Maintenance Assets"
};

var SHEET_TO_MAIN_CATEGORY_ = {
  "IT Assets": "IT Assets", "Office Assets": "Office Assets", "Electrical Assets": "Electrical Assets",
  "Production Assets": "Production Assets", "Safety Assets": "Safety Assets", "Vehicle Assets": "Vehicle Assets",
  "Furniture Assets": "Furniture Assets", "Software License Assets": "Software / License Assets",
  "Admin Facility Assets": "Admin / Facility Assets", "Maintenance Assets": "Maintenance Assets"
};

function getMasterHeaders_() {
  return CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeId_(id) {
  return String(id || "").replace(/^0+/, "").trim().toLowerCase();
}

function indexOfNormalized_(headers, target) {
  var t = String(target || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "") === t) return i;
  }
  return -1;
}

function cellToString_(val) {
  if (val == null || val === "") return "";
  if (Object.prototype.toString.call(val) === "[object Date]" && !isNaN(val.getTime())) {
    return val.toISOString();
  }
  return String(val).trim();
}

function masterVal_(masterRow, masterHeaders, name) {
  var lookups = [name];
  var norm = String(name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (norm === "assigneddate") {
    lookups = [name, "Assign Date", "Assignment Date"];
  }
  for (var l = 0; l < lookups.length; l++) {
    var i = indexOfNormalized_(masterHeaders, lookups[l]);
    if (i === -1) continue;
    return cellToString_(masterRow[i]);
  }
  return "";
}

function mapMasterRowToSheetRow_(sheetHeaders, masterHeaders, masterRow) {
  var out = new Array(sheetHeaders.length);
  for (var h = 0; h < sheetHeaders.length; h++) {
    var src = indexOfNormalized_(masterHeaders, sheetHeaders[h]);
    if (src === -1) {
      var norm = String(sheetHeaders[h] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (norm === "email" || norm === "mailid") src = indexOfNormalized_(masterHeaders, "Contact Email");
      else if (norm === "mobile" || norm === "contactnumber") src = indexOfNormalized_(masterHeaders, "Contact Number");
      else if (norm === "assigneddate" || norm === "assigndate" || norm === "assignmentdate") {
        src = indexOfNormalized_(masterHeaders, "Assigned Date");
      }
    }
    out[h] = src !== -1 && src < masterRow.length && masterRow[src] != null ? masterRow[src] : "";
  }
  return out;
}

function mapSheetRowToMasterRow_(sheetHeaders, masterHeaders, sheetRow) {
  var out = new Array(masterHeaders.length);
  for (var m = 0; m < masterHeaders.length; m++) {
    var src = indexOfNormalized_(sheetHeaders, masterHeaders[m]);
    var norm = String(masterHeaders[m] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (src === -1 && norm === "maincategory") {
      src = indexOfNormalized_(sheetHeaders, "Category");
    }
    out[m] = src !== -1 && src < sheetRow.length && sheetRow[src] != null ? cellToString_(sheetRow[src]) : "";
  }
  return out;
}

function resolveCategorySheet_(mainCategory) {
  var mapped = CATEGORY_SHEET_MAP_[String(mainCategory || "").trim()] || "IT Assets";
  return CATEGORIES.indexOf(mapped) !== -1 ? mapped : "IT Assets";
}

function getCategorySheet_(ss, mainCategory) {
  var name = resolveCategorySheet_(mainCategory);
  return ss.getSheetByName(name);
}

var SYSTEM_SHEET_NAMES_ = {
  "Users": true,
  "OTP_Log": true,
  "Locations": true,
  "Plants": true,
  "Options": true,
  "Asset_Details": true,
  "Category_Definitions": true,
  "Employees": true,
  "Assignment_History": true,
  "Inventory": true,
  "Damaged_Items": true,
  "Missing_Items": true,
  "Audit_Logs": true,
  "Categories": true,
  "Asset_Types": true,
  "Asset_Extra_Items": true,
  "Assignments": true,
};

function isCategorySheetName_(name) {
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i] === name) return true;
  }
  return false;
}

function isSystemSheetName_(name) {
  return !!SYSTEM_SHEET_NAMES_[name];
}

function collectMirrorSheetNames_(ss) {
  var names = {};
  var locSh = ss.getSheetByName("Locations");
  if (locSh && locSh.getLastRow() > 1) {
    var locData = locSh.getDataRange().getValues();
    var locHeaders = locData[0];
    var locIdx = locHeaders.indexOf("Location Name");
    if (locIdx !== -1) {
      for (var l = 1; l < locData.length; l++) {
        var locName = sanitizeSheetName_(locData[l][locIdx]);
        if (locName) names[locName] = true;
      }
    }
  }

  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var plantData = plantSh.getDataRange().getValues();
    var plantHeaders = plantData[0];
    var codeIdx = plantHeaders.indexOf("Plant Code");
    if (codeIdx !== -1) {
      for (var p = 1; p < plantData.length; p++) {
        var plantCode = sanitizeSheetName_(plantData[p][codeIdx]);
        if (plantCode) names[plantCode] = true;
      }
    }
  }
  return names;
}

function sheetHasAssetHeaders_(headers) {
  return (
    indexOfNormalized_(headers, "Asset ID") !== -1 ||
    indexOfNormalized_(headers, "S No") !== -1 ||
    indexOfNormalized_(headers, "Asset Code") !== -1 ||
    indexOfNormalized_(headers, "Asset Name") !== -1
  );
}

function assetRowSyncKey_(sheetHeaders, row) {
  var idIdx = indexOfNormalized_(sheetHeaders, "Asset ID");
  if (idIdx === -1) idIdx = indexOfNormalized_(sheetHeaders, "S No");
  if (idIdx !== -1) {
    var id = String(row[idIdx] || "").trim();
    if (id) return "id:" + normalizeId_(id);
  }
  var codeIdx = indexOfNormalized_(sheetHeaders, "Asset Code");
  if (codeIdx !== -1) {
    var code = String(row[codeIdx] || "").trim().toLowerCase();
    if (code) return "code:" + code;
  }
  var snIdx = indexOfNormalized_(sheetHeaders, "Serial Number");
  if (snIdx !== -1) {
    var sn = String(row[snIdx] || "").trim().toLowerCase();
    if (sn) return "sn:" + sn;
  }
  return "";
}

function sheetRowHasAssetData_(sheetHeaders, row) {
  if (assetRowSyncKey_(sheetHeaders, row)) return true;
  var nameIdx = indexOfNormalized_(sheetHeaders, "Asset Name");
  if (nameIdx !== -1 && String(row[nameIdx] || "").trim()) return true;
  return row.some(function (v) {
    return String(v || "").trim() !== "";
  });
}

function resolveRowMainCategory_(sheetName, masterRow, masterHeaders, canonicalMainOverride) {
  var mainIdx = indexOfNormalized_(masterHeaders, "Main Category");
  if (mainIdx !== -1 && String(masterRow[mainIdx] || "").trim()) {
    return String(masterRow[mainIdx]).trim();
  }
  if (canonicalMainOverride) return canonicalMainOverride;
  if (isCategorySheetName_(sheetName)) {
    return SHEET_TO_MAIN_CATEGORY_[sheetName] || sheetName;
  }
  return "IT Assets";
}

/** Read rows from one tab into master format; skips duplicates via seenKeys. */
function appendAssetsFromSheet_(sh, masterHeaders, allAssets, seenKeys, canonicalMainOverride) {
  if (!sh || sh.getLastRow() < 2) return 0;
  var data = sh.getDataRange().getValues();
  var sheetHeaders = data[0];
  if (!sheetHasAssetHeaders_(sheetHeaders)) return 0;

  var added = 0;
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (!sheetRowHasAssetData_(sheetHeaders, row)) continue;

    var key = assetRowSyncKey_(sheetHeaders, row);
    if (key && seenKeys[key]) continue;

    var masterRow = mapSheetRowToMasterRow_(sheetHeaders, masterHeaders, row);
    var mainIdx = indexOfNormalized_(masterHeaders, "Main Category");
    if (mainIdx !== -1) {
      masterRow[mainIdx] = resolveRowMainCategory_(sh.getName(), masterRow, masterHeaders, canonicalMainOverride);
    }

    if (key) seenKeys[key] = true;
    allAssets.push(masterRow);
    added++;
  }
  return added;
}

function listAssetDataSheets_(ss) {
  var ordered = [];
  var seen = {};

  for (var c = 0; c < CATEGORIES.length; c++) {
    var cat = CATEGORIES[c];
    var catSh = ss.getSheetByName(cat);
    if (catSh) {
      ordered.push(catSh);
      seen[cat] = true;
    }
  }

  var legacy = ss.getSheetByName("Assets");
  if (legacy && !seen["Assets"]) {
    ordered.push(legacy);
    seen["Assets"] = true;
  }

  var sheets = ss.getSheets();
  var mirrorSheetNames = collectMirrorSheetNames_(ss);
  for (var s = 0; s < sheets.length; s++) {
    var name = sheets[s].getName();
    if (seen[name] || isSystemSheetName_(name) || mirrorSheetNames[name] || name.indexOf("ARCHIVED_") === 0) continue;
    var hdr = sheets[s].getLastColumn() > 0
      ? sheets[s].getRange(1, 1, 1, sheets[s].getLastColumn()).getValues()[0]
      : [];
    if (sheetHasAssetHeaders_(hdr)) {
      ordered.push(sheets[s]);
      seen[name] = true;
    }
  }
  return ordered;
}

function readAllAssetsForApi_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var masterHeaders = getMasterHeaders_();
  var allAssets = [masterHeaders.slice()];
  var seenKeys = {};
  var sheets = listAssetDataSheets_(ss);

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var canonicalMain = isCategorySheetName_(sh.getName())
      ? SHEET_TO_MAIN_CATEGORY_[sh.getName()] || sh.getName()
      : null;
    appendAssetsFromSheet_(sh, masterHeaders, allAssets, seenKeys, canonicalMain);
  }

  return allAssets;
}

function findAssetInCategories_(ss, assetId) {
  var idStr = normalizeId_(assetId);
  var sheets = listAssetDataSheets_(ss);

  for (var s = 0; s < sheets.length; s++) {
    var sh = sheets[s];
    if (!sh || sh.getLastRow() < 2) continue;
    var data = sh.getDataRange().getValues();
    var sheetHeaders = data[0];
    if (!sheetHasAssetHeaders_(sheetHeaders)) continue;

    var idIdx = indexOfNormalized_(sheetHeaders, "Asset ID");
    if (idIdx === -1) idIdx = indexOfNormalized_(sheetHeaders, "S No");
    if (idIdx === -1) idIdx = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowId = idIdx !== -1 ? normalizeId_(row[idIdx]) : "";
      var rowKey = assetRowSyncKey_(sheetHeaders, row);
      if (rowId === idStr || rowKey === "id:" + idStr) {
        return { sheet: sh, rowIndex: i, sheetHeaders: sheetHeaders, sheetName: sh.getName() };
      }
      var codeIdx = indexOfNormalized_(sheetHeaders, "Asset Code");
      if (codeIdx !== -1 && String(row[codeIdx] || "").trim().toLowerCase() === idStr) {
        return { sheet: sh, rowIndex: i, sheetHeaders: sheetHeaders, sheetName: sh.getName() };
      }
    }
  }
  return null;
}

function addAssetIdentifier_(idMap, value) {
  var norm = normalizeId_(value);
  if (norm) idMap[norm] = true;
}

function collectAssetIdentifiers_(ss, assetId) {
  var idMap = {};
  addAssetIdentifier_(idMap, assetId);

  var changed = true;
  while (changed) {
    changed = false;
    var beforeCount = Object.keys(idMap).length;
    var sheets = listAssetDataSheets_(ss);
    for (var s = 0; s < sheets.length; s++) {
      var sh = sheets[s];
      if (!sh || sh.getLastRow() < 2) continue;
      var data = sh.getDataRange().getValues();
      var headers = data[0];
      if (!sheetHasAssetHeaders_(headers)) continue;

      for (var r = 1; r < data.length; r++) {
        if (!assetRowMatchesIdentifiers_(headers, data[r], idMap)) continue;
        addAssetIdentifierFromRow_(idMap, headers, data[r]);
      }
    }
    changed = Object.keys(idMap).length > beforeCount;
  }

  return idMap;
}

function addAssetIdentifierFromRow_(idMap, headers, row) {
  var names = ["Asset ID", "S No", "ID", "Asset Code", "Unique Code"];
  for (var n = 0; n < names.length; n++) {
    var idx = indexOfNormalized_(headers, names[n]);
    if (idx !== -1) addAssetIdentifier_(idMap, row[idx]);
  }
}

function assetRowMatchesIdentifiers_(headers, row, idMap) {
  var names = ["Asset ID", "S No", "ID", "Asset Code", "Unique Code"];
  for (var n = 0; n < names.length; n++) {
    var idx = indexOfNormalized_(headers, names[n]);
    if (idx !== -1 && idMap[normalizeId_(row[idx])]) return true;
  }
  return false;
}

function deleteRowsByIdentifierColumns_(sh, idMap, columnNames) {
  if (!sh || sh.getLastRow() < 2) return 0;
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var cols = [];
  for (var c = 0; c < columnNames.length; c++) {
    var idx = indexOfNormalized_(headers, columnNames[c]);
    if (idx !== -1) cols.push(idx);
  }
  if (cols.length === 0) return 0;

  var deleted = 0;
  for (var r = data.length - 1; r >= 1; r--) {
    var match = false;
    for (var i = 0; i < cols.length; i++) {
      if (idMap[normalizeId_(data[r][cols[i]])]) {
        match = true;
        break;
      }
    }
    if (match) {
      sh.deleteRow(r + 1);
      deleted++;
    }
  }
  return deleted;
}

function deleteAssetEverywhere_(ss, assetId) {
  var idMap = collectAssetIdentifiers_(ss, assetId);
  var deleted = 0;

  var sheets = listAssetDataSheets_(ss);
  for (var s = 0; s < sheets.length; s++) {
    deleted += deleteRowsByIdentifierColumns_(sheets[s], idMap, ["Asset ID", "S No", "ID", "Asset Code", "Unique Code"]);
  }

  var details = ss.getSheetByName("Asset_Details");
  deleted += deleteRowsByIdentifierColumns_(details, idMap, ["Asset ID"]);

  var extra = ss.getSheetByName("Asset_Extra_Items");
  deleted += deleteRowsByIdentifierColumns_(extra, idMap, ["Parent Asset ID", "Asset ID"]);

  var assignments = ss.getSheetByName("Assignments");
  deleted += deleteRowsByIdentifierColumns_(assignments, idMap, ["Asset ID", "Item ID", "Asset/Inventory ID"]);

  var inventory = ss.getSheetByName("Inventory");
  deleted += deleteRowsByIdentifierColumns_(inventory, idMap, ["Item ID", "Asset Code", "Asset ID"]);

  var missing = ss.getSheetByName("Missing_Items");
  deleted += deleteRowsByIdentifierColumns_(missing, idMap, ["Parent Asset ID", "Asset ID"]);

  var damaged = ss.getSheetByName("Damaged_Items");
  deleted += deleteRowsByIdentifierColumns_(damaged, idMap, ["Asset ID"]);

  var history = ss.getSheetByName("Assignment_History");
  deleted += deleteRowsByIdentifierColumns_(history, idMap, ["Asset ID"]);

  syncLocationAndPlantAssetSheets_(ss);
  return { success: true, message: "Asset deleted everywhere", deletedRows: deleted };
}

function deleteAssetFromOtherSheets_(ss, assetId, keepSheetName) {
  var idStr = normalizeId_(assetId);
  for (var c = 0; c < CATEGORIES.length; c++) {
    var cat = CATEGORIES[c];
    if (cat === keepSheetName) continue;
    var sh = ss.getSheetByName(cat);
    if (!sh || sh.getLastRow() < 2) continue;
    var data = sh.getDataRange().getValues();
    var idIdx = indexOfNormalized_(data[0], "Asset ID");
    if (idIdx === -1) idIdx = 0;
    for (var i = 1; i < data.length; i++) {
      if (normalizeId_(data[i][idIdx]) === idStr) {
        sh.deleteRow(i + 1);
        break;
      }
    }
  }
}

function addAssetRow_(ss, masterRow) {
  var masterHeaders = getMasterHeaders_();
  var mainCat = masterVal_(masterRow, masterHeaders, "Main Category") || "IT Assets";
  var sheetName = resolveCategorySheet_(mainCat);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { error: "Sheet '" + sheetName + "' not found. Create tab with Row 1 headers from NEW_SHEET_ROW1_HEADERS.txt" };

  var mainIdx = indexOfNormalized_(masterHeaders, "Main Category");
  if (mainIdx !== -1) masterRow[mainIdx] = SHEET_TO_MAIN_CATEGORY_[sheetName] || mainCat;

  var id = masterVal_(masterRow, masterHeaders, "Asset ID");
  if (!id) {
    var total = 0;
    for (var c = 0; c < CATEGORIES.length; c++) {
      var s = ss.getSheetByName(CATEGORIES[c]);
      if (s && s.getLastRow() > 1) total += s.getLastRow() - 1;
    }
    id = ("000" + (total + 1)).slice(-3);
    var idIdx = indexOfNormalized_(masterHeaders, "Asset ID");
    if (idIdx !== -1) masterRow[idIdx] = id;
  }

  var sheetHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(mapMasterRowToSheetRow_(sheetHeaders, masterHeaders, masterRow));
  syncLocationAndPlantAssetSheets_(ss);
  return { success: true, message: "Asset added", id: id };
}

function updateAssetRow_(ss, assetId, masterRow) {
  var masterHeaders = getMasterHeaders_();
  var mainCat = masterVal_(masterRow, masterHeaders, "Main Category") || "IT Assets";
  var sheetName = resolveCategorySheet_(mainCat);
  var mainIdx = indexOfNormalized_(masterHeaders, "Main Category");
  if (mainIdx !== -1) masterRow[mainIdx] = SHEET_TO_MAIN_CATEGORY_[sheetName] || mainCat;

  deleteAssetFromOtherSheets_(ss, assetId, sheetName);

  var found = findAssetInCategories_(ss, assetId);
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { error: "Sheet '" + sheetName + "' not found" };

  var sheetHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var physical = mapMasterRowToSheetRow_(sheetHeaders, masterHeaders, masterRow);

  if (found && found.sheetName === sheetName) {
    sh.getRange(found.rowIndex + 1, 1, 1, physical.length).setValues([physical]);
  } else if (found) {
    found.sheet.deleteRow(found.rowIndex + 1);
    sh.appendRow(physical);
  } else {
    sh.appendRow(physical);
  }
  syncLocationAndPlantAssetSheets_(ss);
  return { success: true, message: "Asset updated" };
}

function deleteAssetRow_(ss, assetId) {
  var result = deleteAssetEverywhere_(ss, assetId);
  if (!result.deletedRows) return { error: "Asset not found" };
  return result;
}

// --- HTTP ---

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = params.action ? params.action : "";
    var type = params.type ? params.type : "assets";

    if (action === "list_users" || action === "get_users" || type === "users") return json_(listUsersFromSheet_());
    if (action === "get_asset_details") return json_({ success: true, details: getAssetDetailsMap_() });
    if (action === "get_type_definitions") return json_({ success: true, types: getTypeDefinitions_() });
    if (action === "get_assignment_history") return json_({ success: true, history: getAssignmentHistory_() });
    if (action === "list_employees") return json_({ success: true, employees: listEmployees_() });
    if (action === "list_inventory") return json_({ success: true, inventory: listInventory_() });
    if (action === "list_assets_redesigned") return json_({ success: true, assets: listRedesignedTable_("Assets") });
    if (action === "list_categories") return json_({ success: true, categories: listRedesignedTable_("Categories") });
    if (action === "list_asset_types") return json_({ success: true, types: listRedesignedTable_("Asset_Types") });
    if (action === "list_extra_items") return json_({ success: true, items: listRedesignedTable_("Asset_Extra_Items") });
    if (action === "list_assignments") return json_({ success: true, assignments: listRedesignedTable_("Assignments") });
    if (action === "list_damaged_items") return json_({ success: true, items: listRedesignedTable_("Damaged_Items") });
    if (action === "list_missing_items") return json_({ success: true, items: listRedesignedTable_("Missing_Items") });
    if (action === "list_audit_logs") return json_({ success: true, logs: listRedesignedTable_("Audit_Logs") });
    if (action === "list_locations_plants") {
      ensureLocationsPlantsSheets_(ss);
      return json_({ success: true, locations: listLocationsFromSheet_(), plants: listPlantsFromSheet_() });
    }
    if (action === "get_asset_headers") return json_({ success: true, headers: getMasterHeaders_() });

    if (type === "options") {
      var optSh = ss.getSheetByName("Options");
      if (!optSh) return json_({ success: true, options: {} });
      var data = optSh.getDataRange().getValues();
      var options = {};
      for (var i = 1; i < data.length; i++) {
        var k = data[i][0];
        if (!options[k]) options[k] = [];
        options[k].push(data[i][1]);
      }
      return json_({ success: true, options: options });
    }

    return json_(readAllAssetsForApi_());
  } catch (err) {
    return json_({ error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (action === "list_users" || action === "get_users" || action === "read_users") return json_(listUsersFromSheet_());
    if (action === "list_employees" || action === "get_employees" || action === "read_employees") return json_({ success: true, employees: listEmployees_() });
    if (action === "read_all_assets") return json_(readAllAssetsForApi_());
    if (action === "setup") {
      var setupMsg = setupSheets();
      return json_({ success: true, message: setupMsg });
    }
    if (action === "migrate_old_sheets" || action === "rebuild_asset_sheets") {
      return json_({ success: true, message: "Use setupSheets() or Run > main in code.gs for new sheet." });
    }
    if (action === "sync_location_plant_sheets") {
      syncLocationAndPlantAssetSheets_(ss);
      return json_({ success: true, message: "Location & plant view sheets refreshed from assets." });
    }
    if (action === "clear_assignment_history") {
      clearAssignmentHistorySheet_();
      return json_({ success: true, message: "Assignment history cleared." });
    }

    if (action === "add") return json_(addAssetRow_(ss, body.row));
    if (action === "update") return json_(updateAssetRow_(ss, String(body.id), body.row));
    if (action === "delete") return json_(deleteAssetRow_(ss, String(body.id)));

    if (action === "add_asset_redesigned") return json_(addRedesignedRow_("Assets", body.row, "Asset ID"));
    if (action === "update_asset_redesigned") return json_(updateRedesignedRow_("Assets", body.id, body.row, "Asset ID"));
    if (action === "delete_asset_redesigned") return json_(deleteAssetEverywhere_(ss, body.id));
    if (action === "add_category") return json_(addRedesignedRow_("Categories", body.row, "Category Name"));
    if (action === "update_category") return json_(updateRedesignedRow_("Categories", body.id, body.row, "Category Name"));
    if (action === "delete_category") return json_(deleteRedesignedRow_("Categories", body.id, "Category Name"));
    if (action === "add_asset_type") return json_(addRedesignedRow_("Asset_Types", body.row, "Type ID"));
    if (action === "delete_asset_type") return json_(deleteRedesignedRow_("Asset_Types", body.id, "Type ID"));
    if (action === "add_extra_item") return json_(addRedesignedRow_("Asset_Extra_Items", body.row, "Record ID"));
    if (action === "update_extra_item") return json_(updateRedesignedRow_("Asset_Extra_Items", body.id, body.row, "Record ID"));
    if (action === "delete_extra_item") return json_(deleteRedesignedRow_("Asset_Extra_Items", body.id, "Record ID"));
    if (action === "add_assignment") return json_(addRedesignedRow_("Assignments", body.row, "Assignment ID"));
    if (action === "delete_assignment") return json_(deleteRedesignedRow_("Assignments", body.id, "Assignment ID"));
    if (action === "add_damaged_item") return json_(addRedesignedRow_("Damaged_Items", body.row, "Record ID"));
    if (action === "update_damaged_item") return json_(updateRedesignedRow_("Damaged_Items", body.id, body.row, "Record ID"));
    if (action === "delete_damaged_item") return json_(deleteRedesignedRow_("Damaged_Items", body.id, "Record ID"));
    if (action === "add_missing_item") return json_(addRedesignedRow_("Missing_Items", body.row, "Record ID"));
    if (action === "update_missing_item") return json_(updateRedesignedRow_("Missing_Items", body.id, body.row, "Record ID"));
    if (action === "delete_missing_item") return json_(deleteRedesignedRow_("Missing_Items", body.id, "Record ID"));
    if (action === "add_audit_log") return json_(addRedesignedRow_("Audit_Logs", body.row, "Log ID"));

    if (action === "sync_locations_plants") return json_(syncLocationsPlantsSheets_(body.locations, body.plants));
    if (action === "rename_location") return json_(renameLocationInSheets_(body.oldName, body.newName));
    if (action === "delete_location") return json_(deleteLocationInSheets_(body.name, body.deleteOrArchive));
    if (action === "rename_plant") return json_(renamePlantInSheets_(body.oldCode, body.newCode, body.newName, body.location));
    if (action === "delete_plant") return json_(deletePlantInSheets_(body.code, body.deleteOrArchive));

    if (action === "request_otp") return json_(handleRequestOtp_(ss, body));
    if (action === "verify_otp") return json_(handleVerifyOtp_(ss, body));
    if (action === "upload_file") return json_(handleFileUpload_(body));
    if (action === "get_file_base64") return json_(handleGetFileBase64_(body));

    if (action === "save_asset_details") { saveAssetDetails_(String(body.assetId || ""), body.details || {}); return json_({ success: true }); }
    if (action === "delete_asset_details") { deleteAssetDetails_(String(body.assetId || "")); return json_({ success: true }); }
    if (action === "save_type_definitions") { saveTypeDefinitions_(body.types || []); return json_({ success: true }); }
    if (action === "add_employee") return json_(addEmployee_(body.employee || {}));
    if (action === "update_employee") return json_(updateEmployee_(body.employee || {}));
    if (action === "delete_employee") return json_(deleteEmployee_(body.employee || {}));
    if (action === "add_assignment_history") return json_(addAssignmentHistory_(body.entry || {}));
    if (action === "delete_assignment_history") return json_(deleteAssignmentHistory_(String(body.id || "")));
    if (action === "add_inventory_item") return json_(addInventoryItem_(body.item || {}));
    if (action === "update_inventory_item") return json_(updateInventoryItem_(body.item || {}));
    if (action === "delete_inventory_item") return json_(deleteInventoryItem_(body.item || {}));
    if (action === "replace_inventory") return json_(replaceInventory_(body.inventory || []));

    if (action === "add_user" || action === "addUser" || action === "append_user") return json_(addUserToSheet_(body));
    if (action === "update_user" || action === "updateUser" || action === "edit_user") return json_(updateUserInSheet_(body));
    if (action === "delete_user" || action === "deleteUser" || action === "remove_user") return json_(deleteUserFromSheet_(body));
    if (action === "add_option") {
      var optSh = ss.getSheetByName("Options");
      if (!optSh) return json_({ error: "Options sheet not found" });
      optSh.appendRow([body.type, body.value]);
      return json_({ success: true });
    }
    if (action === "delete_option") return json_(handleDeleteOption_(ss, body));

    return json_({ error: "Unknown action: " + action });
  } catch (err) {
    return json_({ error: String(err) });
  }
}
function ensureMetaSheets_(ss) {
  var details = ss.getSheetByName("Asset_Details");
  if (!details) {
    details = ss.insertSheet("Asset_Details");
    details.getRange(1, 1, 1, 4).setValues([["Asset ID", "Field Key", "Field Value", "Updated At"]]);
    details.setFrozenRows(1);
  }
  var defs = ss.getSheetByName("Category_Definitions");
  if (!defs) {
    defs = ss.insertSheet("Category_Definitions");
    defs.getRange(1, 1, 1, 2).setValues([["Type ID", "Config JSON"]]);
    defs.setFrozenRows(1);
  }
  var empSh = ss.getSheetByName("Employees");
  if (!empSh) {
    empSh = ss.insertSheet("Employees");
    empSh.getRange(1, 1, 1, 11).setValues([[
      "Employee ID", "Name", "Email", "Phone", "Department", "Location", "Designation", "Plant Code", "Status", "Created Date", "Updated Date"
    ]]);
    empSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(empSh, [
      "Employee ID", "Name", "Email", "Phone", "Department", "Location", "Designation", "Plant Code", "Status", "Created Date", "Updated Date"
    ]);
  }
  var histSh = ss.getSheetByName("Assignment_History");
  if (!histSh) {
    histSh = ss.insertSheet("Assignment_History");
    histSh.getRange(1, 1, 1, 11).setValues([[
      "Record ID", "Asset ID", "Action", "Employee ID", "Employee Name", "Assigned Date", "Returned Date", "Assigned By", "Remarks", "From Employee ID", "From Employee Name"
    ]]);
    histSh.setFrozenRows(1);
  }
  var invSh = ss.getSheetByName("Inventory");
  if (!invSh) {
    invSh = ss.insertSheet("Inventory");
    invSh.getRange(1, 1, 1, 15).setValues([[
      "Item ID", "Asset Code", "Item Name", "Brand Name", "Model", "Serial Number", "Category", "Status", "Quantity", "Min Stock", "Employee ID", "Assignee Name", "Assignee Email", "Contact Number", "Updated Date"
    ]]);
    invSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(invSh, [
      "Item ID", "Asset Code", "Item Name", "Brand Name", "Model", "Serial Number", "Category", "Status", "Quantity", "Min Stock", "Employee ID", "Assignee Name", "Assignee Email", "Contact Number", "Updated Date"
    ]);
  }
  var missingSh = ss.getSheetByName("Missing_Items");
  var missingHeaders = ["Record ID", "Parent Asset ID", "Parent Asset Name", "Missing Item Name", "Asset Type", "Brand", "Model", "Employee ID", "Assigned Person", "Missing Date", "Status", "Remarks", "Recovered Date", "Recovered By"];
  if (!missingSh) {
    missingSh = ss.insertSheet("Missing_Items");
    missingSh.getRange(1, 1, 1, missingHeaders.length).setValues([missingHeaders]);
    missingSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(missingSh, missingHeaders);
  }
  var damagedSh = ss.getSheetByName("Damaged_Items");
  var damagedHeaders = ["Record ID", "Asset ID", "Asset Name", "Damage Date", "Damage Reason", "Reported By", "Repair Required", "Estimated Cost", "Status", "Remarks", "Photo URL"];
  if (!damagedSh) {
    damagedSh = ss.insertSheet("Damaged_Items");
    damagedSh.getRange(1, 1, 1, damagedHeaders.length).setValues([damagedHeaders]);
    damagedSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(damagedSh, damagedHeaders);
  }
}

function ensureSheetHeaders_(sh, targetHeaders) {
  var lastCol = sh.getLastColumn();
  if (lastCol === 0) {
    sh.getRange(1, 1, 1, targetHeaders.length).setValues([targetHeaders]);
    return;
  }
  var currentHeaders = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var missingHeaders = [];
  for (var i = 0; i < targetHeaders.length; i++) {
    if (currentHeaders.indexOf(targetHeaders[i]) === -1) {
      missingHeaders.push(targetHeaders[i]);
    }
  }
  if (missingHeaders.length > 0) {
    sh.getRange(1, lastCol + 1, 1, missingHeaders.length).setValues([missingHeaders]);
  }
}
function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getOtpLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(OTP_LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(OTP_LOG_SHEET_NAME);
    sheet.getRange(1, 1, 1, OTP_LOG_HEADERS_.length).setValues([OTP_LOG_HEADERS_]);
    var hr = sheet.getRange(1, 1, 1, OTP_LOG_HEADERS_.length);
    hr.setBackground("#b45309");
    hr.setFontColor("#ffffff");
    hr.setFontWeight("bold");
    sheet.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(sheet, OTP_LOG_HEADERS_);
  }
  return sheet;
}

function findOtpLogColIndexes_(headers) {
  var norm = headers.map(function (h) {
    return String(h).toLowerCase().replace(/[^a-z0-9]/g, "");
  });
  var emailIdx = -1;
  for (var e = 0; e < norm.length; e++) {
    if (norm[e].indexOf("email") !== -1 || norm[e].indexOf("mail") !== -1) {
      emailIdx = e;
      break;
    }
  }
  var requestedIdx = -1;
  for (var r = 0; r < norm.length; r++) {
    if (norm[r].indexOf("requested") !== -1) {
      requestedIdx = r;
      break;
    }
  }
  return {
    email: emailIdx,
    otp: norm.indexOf("otp"),
    expiry: norm.indexOf("expiry"),
    attempts: norm.indexOf("attempts"),
    requestedAt: requestedIdx,
    status: norm.indexOf("status"),
  };
}

/** Save plain OTP (no hash) to OTP_Log — one row per email, updated on each request. */
function saveOtpLogEntry_(email, otp, expiryMs) {
  var sheet = getOtpLogSheet_();
  var data = sheet.getDataRange().getValues();
  var idx = findOtpLogColIndexes_(data[0]);
  if (idx.email === -1 || idx.otp === -1) {
    throw new Error("OTP_Log sheet missing Email or OTP column");
  }

  var nowIso = new Date().toISOString();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][idx.email]) === email) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    var newRow = new Array(Math.max(data[0].length, OTP_LOG_HEADERS_.length)).fill("");
    newRow[idx.email] = email;
    newRow[idx.otp] = otp;
    if (idx.expiry !== -1) newRow[idx.expiry] = String(expiryMs);
    if (idx.attempts !== -1) newRow[idx.attempts] = 0;
    if (idx.requestedAt !== -1) newRow[idx.requestedAt] = nowIso;
    if (idx.status !== -1) newRow[idx.status] = "Pending";
    sheet.appendRow(newRow);
    return;
  }

  var rowNum = rowIndex + 1;
  sheet.getRange(rowNum, idx.otp + 1).setValue(otp);
  if (idx.expiry !== -1) sheet.getRange(rowNum, idx.expiry + 1).setValue(String(expiryMs));
  if (idx.attempts !== -1) sheet.getRange(rowNum, idx.attempts + 1).setValue(0);
  if (idx.requestedAt !== -1) sheet.getRange(rowNum, idx.requestedAt + 1).setValue(nowIso);
  if (idx.status !== -1) sheet.getRange(rowNum, idx.status + 1).setValue("Pending");
}

function readOtpLogEntry_(email) {
  var sheet = getOtpLogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return null;

  var idx = findOtpLogColIndexes_(data[0]);
  if (idx.email === -1 || idx.otp === -1) return null;

  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][idx.email]) === email) {
      var row = data[i];
      return {
        sheet: sheet,
        rowIndex: i,
        idx: idx,
        otp: String(row[idx.otp] || "").trim(),
        expiry: idx.expiry !== -1 ? parseInt(row[idx.expiry], 10) || 0 : 0,
        attempts: idx.attempts !== -1 ? parseInt(row[idx.attempts], 10) || 0 : 0,
      };
    }
  }
  return null;
}

function markOtpLogVerified_(entry) {
  if (!entry) return;
  var rowNum = entry.rowIndex + 1;
  entry.sheet.getRange(rowNum, entry.idx.otp + 1).setValue("");
  if (entry.idx.expiry !== -1) entry.sheet.getRange(rowNum, entry.idx.expiry + 1).setValue("");
  if (entry.idx.attempts !== -1) entry.sheet.getRange(rowNum, entry.idx.attempts + 1).setValue(0);
  if (entry.idx.status !== -1) entry.sheet.getRange(rowNum, entry.idx.status + 1).setValue("Verified");
}

function incrementOtpLogAttempts_(entry) {
  if (!entry || entry.idx.attempts === -1) return;
  entry.sheet.getRange(entry.rowIndex + 1, entry.idx.attempts + 1).setValue(entry.attempts + 1);
}

function buildOtpEmailHtml_(otp, userRole) {
  var year = new Date().getFullYear();
  var role = userRole || "User";
  return (
    '<!DOCTYPE html><html><head><meta charset="UTF-8"></head>' +
    '<body style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef2f7;padding:40px 0">' +
    '<tr><td align="center">' +
    '<table width="520" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10)">' +
    '<tr><td style="background:#0d1b4b;padding:26px 36px;text-align:center">' +
    '<p style="margin:0;color:#7b93d4;font-size:11px;letter-spacing:3px;text-transform:uppercase">' +
    SENDER_NAME +
    "</p>" +
    '<p style="margin:8px 0 0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.5px">' +
    APP_DISPLAY_NAME +
    "</p>" +
    '<p style="margin:6px 0 0;color:#dbeafe;font-size:12px;letter-spacing:1px">Secure Login</p>' +
    "</td></tr>" +
    '<tr><td style="height:4px;background:#1a56db"></td></tr>' +
    '<tr><td style="padding:36px 40px 28px">' +
    '<p style="margin:0 0 4px;color:#111827;font-size:16px;font-weight:700">Hello,</p>' +
    '<p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.7">A login was requested for your <strong>' +
    APP_DISPLAY_NAME +
    "</strong> account. Enter the code below to verify your identity.</p>" +
    '<p style="margin:0 0 8px;color:#9ca3af;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:700">One-Time Password</p>' +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:8px">' +
    '<tr><td style="background:#f0f4ff;border:2px solid #c7d7fd;border-radius:10px;padding:24px 16px;text-align:center">' +
    '<span style="font-size:42px;font-weight:800;letter-spacing:16px;color:#0d1b4b;font-family:Courier New,Courier,monospace">' +
    otp +
    "</span></td></tr></table>" +
    '<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0 28px">' +
    '<tr><td style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 6px 6px 0;padding:12px 16px">' +
    '<p style="margin:0;color:#c2410c;font-size:13px;font-weight:600">This code expires in 10 minutes.</p>' +
    '<p style="margin:4px 0 0;color:#ea580c;font-size:12px">Do not share this code with anyone.</p>' +
    '<p style="margin:8px 0 0;color:#9ca3af;font-size:11px">Role: <strong>' +
    role +
    "</strong></p></td></tr></table>" +
    '<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">' +
    '<p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.8">If you did not request this login, you can safely ignore this email.</p>' +
    "</td></tr>" +
    '<tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 40px;text-align:center">' +
    '<p style="margin:0 0 3px;color:#9ca3af;font-size:11px">Automated message from ' +
    APP_DISPLAY_NAME +
    " — do not reply.</p>" +
    '<p style="margin:0;color:#d1d5db;font-size:11px">&copy; ' +
    year +
    " PG Group. All rights reserved.</p></td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

function findUserRowIndexes_(headers) {
  var norm = headers.map(function (h) {
    return String(h).toLowerCase().replace(/[^a-z0-9]/g, "");
  });
  var emailIdx = -1;
  for (var e = 0; e < norm.length; e++) {
    if (norm[e].indexOf("email") !== -1 || norm[e].indexOf("mail") !== -1) {
      emailIdx = e;
      break;
    }
  }
  var catIdx = norm.indexOf("categories");
  if (catIdx === -1) catIdx = norm.indexOf("access");
  return {
    email: emailIdx,
    role: norm.indexOf("role"),
    loc: norm.indexOf("locations"),
    plant: norm.indexOf("plants"),
    categories: catIdx,
    otp: norm.indexOf("otp"),
    expiry: norm.indexOf("expiry"),
    attempts: norm.indexOf("attempts"),
  };
}

function handleRequestOtp_(ss, payload) {
  var email = normalizeEmail_(payload.email);
  if (!email) return { error: "Email is required" };

  var usersSheet = getUsersSheet_();
  if (!usersSheet) return { error: "Users sheet not found — create a Users tab in your spreadsheet." };

  var data = usersSheet.getDataRange().getValues();
  if (data.length < 2) return { error: "No users configured. Add your email in the Users sheet." };

  var idx = findUserRowIndexes_(data[0]);
  if (idx.email === -1) return { error: "Email column missing in Users sheet" };

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][idx.email]) === email) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) {
    return { error: "Your mail is not authorized. Please contact IT Admin only." };
  }

  var otp = generateOtp_();
  var expiry = new Date().getTime() + OTP_TTL_MS;
  var userRole = idx.role !== -1 ? data[rowIndex][idx.role] : "User";

  saveOtpLogEntry_(email, otp, expiry);

  try {
    GmailApp.sendEmail(
      email,
      APP_DISPLAY_NAME + " - Login Verification Code",
      "Your " +
        APP_SHORT_NAME +
        " login code is " +
        otp +
        ". Valid for 10 minutes. Do not share it.\n\n- " +
        SENDER_NAME,
      {
        from: SENDER_EMAIL,
        name: SENDER_NAME,
        htmlBody: buildOtpEmailHtml_(otp, userRole),
      }
    );
  } catch (mailErr) {
    Logger.log("GmailApp failed, trying MailApp: " + mailErr);
    try {
      MailApp.sendEmail({
        to: email,
        subject: APP_DISPLAY_NAME + " - Login Verification Code",
        htmlBody: buildOtpEmailHtml_(otp, userRole),
        name: SENDER_NAME,
      });
    } catch (mailErr2) {
      Logger.log("MailApp also failed: " + mailErr2);
      return {
        error:
          "Could not send OTP email. Ensure Gmail alias " +
          SENDER_EMAIL +
          " is configured for Send mail as.",
      };
    }
  }

  return { success: true, message: "OTP sent to " + email };
}

function handleVerifyOtp_(ss, payload) {
  var email = normalizeEmail_(payload.email);
  var otp = String(payload.otp || "").trim();
  if (!email || !otp) return { error: "Email and OTP are required" };

  var usersSheet = getUsersSheet_();
  if (!usersSheet) return { error: "Users sheet not found" };

  var data = usersSheet.getDataRange().getValues();
  var idx = findUserRowIndexes_(data[0]);
  if (idx.email === -1) {
    return { error: "Users sheet not configured — add Email, Role, Locations, Plants columns." };
  }

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][idx.email]) === email) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) return { error: "Email not authorized" };

  var otpEntry = readOtpLogEntry_(email);
  if (!otpEntry || !otpEntry.otp) {
    return { error: "OTP not requested. Please request a new code." };
  }
  if (otpEntry.expiry && new Date().getTime() > otpEntry.expiry) {
    return { error: "OTP has expired. Please request a new one." };
  }
  if (otpEntry.attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Too many failed attempts. Request a new OTP." };
  }

  if (otpEntry.otp !== otp) {
    incrementOtpLogAttempts_(otpEntry);
    return { error: "Invalid OTP. Please try again." };
  }

  markOtpLogVerified_(otpEntry);

  var row = data[rowIndex];
  var locStr = idx.loc !== -1 ? String(row[idx.loc] || "") : "";
  var plantStr = idx.plant !== -1 ? String(row[idx.plant] || "") : "";
  var catStr = idx.categories !== -1 ? String(row[idx.categories] || "") : "";

  var userObj = {
    email: email,
    role: idx.role !== -1 ? String(row[idx.role] || "User") : "User",
    locations: locStr
      ? locStr.split(",").map(function (s) {
          return s.trim();
        }).filter(Boolean)
      : [],
    plants: plantStr
      ? plantStr.split(",").map(function (s) {
          return s.trim();
        }).filter(Boolean)
      : [],
    categories: catStr
      ? catStr.split(",").map(function (s) {
          return s.trim();
        }).filter(Boolean)
      : [],
  };

  return { success: true, user: userObj };
}

// ============================================================
// Users sheet helpers
// ============================================================

function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Users");
  if (!sheet && USERS_SHEET_GID && USERS_SHEET_GID !== 0) {
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === USERS_SHEET_GID) {
        sheet = sheets[i];
        break;
      }
    }
  }
  if (sheet) {
    var userHeaders = ["Email", "Role", "Locations", "Plants", "Categories"];
    ensureSheetHeaders_(sheet, userHeaders);
  }
  return sheet;
}

function findUserColIndexes_(headers) {
  var norm = headers.map(function (h) {
    return String(h).toLowerCase().replace(/[^a-z0-9]/g, "");
  });
  return {
    email: norm.findIndex(function (h) {
      return h.indexOf("email") !== -1 || h.indexOf("mail") !== -1;
    }),
    role: norm.findIndex(function (h) {
      return h.indexOf("role") !== -1;
    }),
    loc: norm.findIndex(function (h) {
      return h.indexOf("location") !== -1;
    }),
    plant: norm.findIndex(function (h) {
      return h.indexOf("plant") !== -1;
    }),
    categories: norm.findIndex(function (h) {
      return h.indexOf("categories") !== -1 || h.indexOf("access") !== -1;
    }),
  };
}

function listUsersFromSheet_() {
  var sheet = getUsersSheet_();
  if (!sheet) return { success: true, users: [] };
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return { success: true, users: [] };
  var idx = findUserColIndexes_(data[0]);
  if (idx.email === -1) return { success: true, users: [] };

  var users = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var em = String(row[idx.email] || "").trim();
    if (!em) continue;
    var loc = idx.loc !== -1 ? row[idx.loc] : "";
    var plt = idx.plant !== -1 ? row[idx.plant] : "";
    var cats = idx.categories !== -1 ? row[idx.categories] : "";
    users.push({
      email: em,
      role: idx.role !== -1 ? row[idx.role] : "User",
      locations: loc,
      plants: plt,
      categories: cats,
    });
  }
  return { success: true, users: users };
}

function normalizeUserInput_(body) {
  var u = body.user || body;
  return {
    email: String(u.email || body.email || "").trim().toLowerCase(),
    role: String(u.role || body.role || "User"),
    locations: u.locations !== undefined ? u.locations : body.locations || "",
    plants: u.plants !== undefined ? u.plants : body.plants || "",
    categories: u.categories !== undefined ? u.categories : body.categories || "",
  };
}

function formatList_(value) {
  if (Object.prototype.toString.call(value) === "[object Array]") {
    return value.join(", ");
  }
  return String(value || "");
}

function addUserToSheet_(body) {
  var user = normalizeUserInput_(body);
  if (!user.email) return { error: "Email is required" };

  var sheet = getUsersSheet_();
  if (!sheet) return { error: "Users sheet not found" };

  var data = sheet.getDataRange().getValues();
  var idx = findUserRowIndexes_(data[0]);
  if (idx.email === -1) return { error: "Email column missing in sheet" };

  for (var r = 1; r < data.length; r++) {
    if (normalizeEmail_(data[r][idx.email]) === user.email) {
      return { error: "User already exists" };
    }
  }

  var newRow = new Array(data[0].length).fill("");
  newRow[idx.email] = user.email;
  if (idx.role !== -1) newRow[idx.role] = user.role;
  if (idx.loc !== -1) newRow[idx.loc] = formatList_(user.locations);
  if (idx.plant !== -1) newRow[idx.plant] = formatList_(user.plants);
  if (idx.categories !== -1) newRow[idx.categories] = formatList_(user.categories);
  if (idx.otp !== -1) newRow[idx.otp] = "";
  if (idx.expiry !== -1) newRow[idx.expiry] = "";
  if (idx.attempts !== -1) newRow[idx.attempts] = 0;

  sheet.appendRow(newRow);
  return { success: true, user: user };
}

function updateUserInSheet_(body) {
  var user = normalizeUserInput_(body);
  if (!user.email) return { error: "Email is required" };

  var sheet = getUsersSheet_();
  if (!sheet) return { error: "Users sheet not found" };

  var data = sheet.getDataRange().getValues();
  var idx = findUserColIndexes_(data[0]);
  if (idx.email === -1) return { error: "Email column missing" };

  var rowNum = -1;
  for (var r = 1; r < data.length; r++) {
    if (normalizeEmail_(data[r][idx.email]) === user.email) {
      rowNum = r + 1;
      break;
    }
  }
  if (rowNum === -1) return { error: "User not found" };

  if (idx.role !== -1) sheet.getRange(rowNum, idx.role + 1).setValue(user.role);
  if (idx.loc !== -1) sheet.getRange(rowNum, idx.loc + 1).setValue(formatList_(user.locations));
  if (idx.plant !== -1) sheet.getRange(rowNum, idx.plant + 1).setValue(formatList_(user.plants));
  if (idx.categories !== -1) sheet.getRange(rowNum, idx.categories + 1).setValue(formatList_(user.categories));

  return { success: true, user: user };
}

function deleteUserFromSheet_(body) {
  var email = normalizeEmail_(body.email || (body.user && body.user.email) || "");
  if (!email) return { error: "Email is required" };

  var sheet = getUsersSheet_();
  if (!sheet) return { error: "Users sheet not found" };

  var data = sheet.getDataRange().getValues();
  var idx = findUserColIndexes_(data[0]);
  if (idx.email === -1) return { error: "Email column missing" };

  for (var r = data.length - 1; r >= 1; r--) {
    if (normalizeEmail_(data[r][idx.email]) === email) {
      if (idx.role !== -1) {
        var role = String(data[r][idx.role] || "").trim();
        if (role === "IT Admin" || role === "IT_ADMIN" || role.toLowerCase() === "it admin") {
          return { error: "IT Admin users cannot be deleted" };
        }
      }
      sheet.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { error: "User not found" };
}
function handleFileUpload_(payload) {
  var folderIter = DriveApp.getFoldersByName("AMS_Documents");
  if (!folderIter.hasNext()) {
    folderIter = DriveApp.getFoldersByName("AssetVault_Documents");
  }
  var folder = folderIter.hasNext()
    ? folderIter.next()
    : DriveApp.createFolder("AMS_Documents");
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var decoded = Utilities.base64Decode(payload.fileData);
  var blob = Utilities.newBlob(decoded, payload.mimeType, payload.filename);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  var fileId = file.getId();
  return {
    success: true,
    url: "https://drive.google.com/uc?export=download&id=" + fileId,
    viewUrl: "https://drive.google.com/file/d/" + fileId + "/preview",
    fileId: fileId,
    fileName: file.getName(),
  };
}

function handleGetFileBase64_(payload) {
  var fileId = payload.fileId;
  if (!fileId) return { error: "Missing fileId" };
  try {
    var file = DriveApp.getFileById(fileId);
    var bytes = file.getBlob().getBytes();
    var base64 = Utilities.base64Encode(bytes);
    return { success: true, base64: base64, mimeType: file.getMimeType() };
  } catch (err) {
    return { error: String(err) };
  }
}

function handleDeleteOption_(ss, payload) {
  var optionsSheet = ss.getSheetByName("Options");
  if (!optionsSheet) return { error: "Options sheet not found" };

  var data = optionsSheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] === payload.type && data[i][1] === payload.value) {
      optionsSheet.deleteRow(i + 1);
      return { success: true, message: "Option deleted" };
    }
  }
  return { error: "Option not found" };
}

// --- Asset_Details (EAV) & Category_Definitions ---

function getAssetDetailsMap_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Asset_Details");
  var map = {};
  if (!sh || sh.getLastRow() < 2) return map;
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var assetId = normalizeId_(String(data[i][0] || ""));
    var key = String(data[i][1] || "").trim();
    var val = String(data[i][2] || "").trim();
    if (!assetId || !key) continue;
    if (!map[assetId]) map[assetId] = {};
    map[assetId][key] = val;
  }
  return map;
}

function saveAssetDetails_(assetId, details) {
  var idStr = normalizeId_(assetId);
  if (!idStr) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  deleteAssetDetails_(idStr);
  var sh = ss.getSheetByName("Asset_Details");
  var now = new Date().toISOString();
  var rows = [];
  for (var key in details) {
    if (!details.hasOwnProperty(key)) continue;
    var val = String(details[key] || "").trim();
    if (!key || val === "") continue;
    rows.push([idStr, key, val, now]);
  }
  if (rows.length > 0) {
    var start = sh.getLastRow() + 1;
    sh.getRange(start, 1, rows.length, 4).setValues(rows);
  }
}

function deleteAssetDetails_(assetId) {
  var idStr = normalizeId_(assetId);
  if (!idStr) return;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Asset_Details");
  if (!sh || sh.getLastRow() < 2) return;
  var data = sh.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (data[i][0] && normalizeId_(data[i][0]) === idStr) {
      sh.deleteRow(i + 1);
    }
  }
}

function getSoftwareLicenseDefaultFields_() {
  return [
    { key: "email_id", label: "Email ID", type: "email", required: true },
    { key: "purchase_date", label: "Purchase Date", type: "date", legacyKey: "purchaseDate" },
    {
      key: "license_type",
      label: "License Type",
      type: "select",
      options: [
        "Standard",
        "Basic",
        "With Teams",
        "Without Teams",
        "Perpetual",
        "Subscription (Monthly)",
        "Subscription (Annual)",
        "Open Source",
        "OEM",
      ],
    },
    { key: "renewal_date", label: "Renewal Date", type: "date", legacyKey: "warrantyEndDate" },
    { key: "seats", label: "Seats / License Count", type: "number" }
  ];
}

function patchSoftwareLicenseTypes_(types) {
  var defaults = getSoftwareLicenseDefaultFields_();
  for (var i = 0; i < types.length; i++) {
    if (types[i].mainCategory === "Software / License Assets") {
      types[i].fields = defaults;
    }
  }
  return types;
}

function getCctvSecurityDefaultFields_() {
  return [
    {
      key: "camera_resolution",
      label: "Camera Resolution",
      type: "select",
      options: ["2MP", "4MP", "5MP", "8MP (4K)", "N/A"],
    },
    {
      key: "channel_count",
      label: "Channels (for NVR)",
      type: "select",
      options: ["4 Channel", "8 Channel", "16 Channel", "32 Channel", "N/A"],
    },
    {
      key: "location_name",
      label: "Location Name",
      type: "text",
      placeholder: "e.g. Main Gate, Warehouse A",
      legacyKey: "hostName",
    },
  ];
}

function patchCctvSecurityTypes_(types) {
  var defaults = getCctvSecurityDefaultFields_();
  for (var i = 0; i < types.length; i++) {
    if (types[i].id === "cctv_security") {
      types[i].fields = defaults;
    }
  }
  return types;
}

function getTypeDefinitions_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Category_Definitions");
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var types = [];
  for (var i = 1; i < data.length; i++) {
    var json = String(data[i][1] || "").trim();
    if (!json) continue;
    try {
      types.push(JSON.parse(json));
    } catch (e) {
      Logger.log("Bad type JSON row " + (i + 1));
    }
  }
  return patchCctvSecurityTypes_(patchSoftwareLicenseTypes_(types));
}

function saveTypeDefinitions_(types) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Category_Definitions");
  if (sh.getLastRow() > 1) {
    sh.deleteRows(2, sh.getLastRow() - 1);
  }
  var rows = [];
  for (var t = 0; t < types.length; t++) {
    var typeObj = types[t];
    if (!typeObj || !typeObj.id) continue;
    rows.push([String(typeObj.id), JSON.stringify(typeObj)]);
  }
  if (rows.length > 0) {
    sh.getRange(2, 1, rows.length, 2).setValues(rows);
  }
}

// --- Employees & Assignment History ---

function listEmployees_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Employees");
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var list = [];
  var seen = {};
  var getByNames = function (row, names) {
    for (var n = 0; n < names.length; n++) {
      var idx = indexOfNormalized_(headers, names[n]);
      if (idx !== -1) return String(row[idx] || "").trim();
    }
    return "";
  };
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var employeeId = getByNames(row, ["Employee ID", "Emp ID", "Employee Code"]).toUpperCase();
    if (!employeeId || seen[employeeId]) continue;
    seen[employeeId] = true;
    list.push({
      employeeId: employeeId,
      name: getByNames(row, ["Name", "Employee Name", "Full Name"]),
      email: getByNames(row, ["Email", "Email ID", "Mail ID"]).toLowerCase(),
      phone: getByNames(row, ["Phone", "Mobile", "Contact Number"]),
      department: getByNames(row, ["Department", "Dept"]),
      location: getByNames(row, ["Location", "Location Name"]),
      designation: getByNames(row, ["Designation", "Role Title"]),
      plant: getByNames(row, ["Plant Code", "Plant / Location", "Plant"]),
      status: getByNames(row, ["Status"]) === "Inactive" ? "Inactive" : "Active",
      createdAt: getByNames(row, ["Created Date", "Created At"]),
      updatedAt: getByNames(row, ["Updated Date", "Updated At"])
    });
  }
  return list;
}

function findEmployeeRow_(employeeId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Employees");
  if (!sh) return -1;
  var idStr = normalizeId_(employeeId);
  var data = sh.getDataRange().getValues();
  if (data.length < 1) return -1;
  var headers = data[0];
  var idIdx = indexOfNormalized_(headers, "Employee ID");
  if (idIdx === -1) idIdx = 0;
  for (var i = 1; i < data.length; i++) {
    if (normalizeId_(data[i][idIdx]) === idStr) return i + 1;
  }
  return -1;
}

function employeeRowFromObject_(headers, emp, createdAt, updatedAt) {
  var out = new Array(headers.length);
  var map = {
    "employeeid": String(emp.employeeId || "").trim().toUpperCase(),
    "name": String(emp.name || "").trim(),
    "email": String(emp.email || "").trim().toLowerCase(),
    "mailid": String(emp.email || "").trim().toLowerCase(),
    "phone": String(emp.phone || "").trim(),
    "mobile": String(emp.phone || "").trim(),
    "contactnumber": String(emp.phone || "").trim(),
    "department": String(emp.department || "").trim(),
    "location": String(emp.location || "").trim(),
    "designation": String(emp.designation || "").trim(),
    "plantcode": String(emp.plant || "").trim(),
    "plant": String(emp.plant || "").trim(),
    "plantlocation": String(emp.plant || "").trim(),
    "status": emp.status === "Inactive" ? "Inactive" : "Active",
    "createddate": createdAt,
    "updateddate": updatedAt
  };
  for (var h = 0; h < headers.length; h++) {
    var norm = String(headers[h] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    out[h] = map[norm] !== undefined ? map[norm] : "";
  }
  return out;
}

function addEmployee_(emp) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Employees");
  var id = String(emp.employeeId || "").trim().toUpperCase();
  if (!id) return { error: "Employee ID required" };
  if (findEmployeeRow_(id) !== -1) return { error: "User already exists" };
  var now = new Date().toISOString();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(employeeRowFromObject_(headers, emp, now, now));
  return { success: true, employee: emp };
}

function updateEmployee_(emp) {
  var row = findEmployeeRow_(emp.employeeId);
  if (row === -1) return addEmployee_(emp);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Employees");
  var now = new Date().toISOString();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var createdIdx = indexOfNormalized_(headers, "Created Date");
  var createdAt = createdIdx !== -1 ? (sh.getRange(row, createdIdx + 1).getValue() || now) : now;
  sh.getRange(row, 1, 1, headers.length).setValues([employeeRowFromObject_(headers, emp, createdAt, now)]);
  return { success: true, employee: emp };
}

function deleteEmployee_(emp) {
  var row = findEmployeeRow_(emp.employeeId);
  if (row === -1) return { error: "Employee not found" };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("Employees").deleteRow(row);
  return { success: true };
}

function getAssignmentHistory_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Assignment_History");
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[1]) continue;
    list.push({
      id: String(r[0] || ""),
      assetId: String(r[1] || ""),
      action: String(r[2] || "Assign"),
      employeeId: String(r[3] || ""),
      employeeName: String(r[4] || ""),
      assignedDate: String(r[5] || ""),
      returnedDate: String(r[6] || ""),
      assignedBy: String(r[7] || ""),
      remarks: String(r[8] || ""),
      fromEmployeeId: String(r[9] || ""),
      fromEmployeeName: String(r[10] || "")
    });
  }
  return list;
}

function addAssignmentHistory_(entry) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Assignment_History");
  var id = String(entry.id || "AH-" + new Date().getTime());
  sh.appendRow([
    id,
    String(entry.assetId || ""),
    String(entry.action || "Assign"),
    String(entry.employeeId || ""),
    String(entry.employeeName || ""),
    String(entry.assignedDate || ""),
    String(entry.returnedDate || ""),
    String(entry.assignedBy || ""),
    String(entry.remarks || ""),
    String(entry.fromEmployeeId || ""),
    String(entry.fromEmployeeName || "")
  ]);
  return { success: true };
}

function deleteAssignmentHistory_(id) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Assignment_History");
  if (!sh || sh.getLastRow() < 2) return { error: "Record not found" };
  var idStr = String(id || "").trim().toLowerCase();
  if (!idStr) return { error: "Record ID required" };
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || "").trim().toLowerCase() === idStr) {
      sh.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: "Record not found" };
}

function clearAssignmentHistorySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Assignment_History");
  if (!sh) return;
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, sh.getLastColumn()).clearContent();
}

function sanitizeSheetName_(name) {
  if (!name) return "";
  var clean = String(name).replace(/[\\\/\?\*\:\[\]]/g, "").replace(/^['"]|['"]$/g, "").trim();
  return clean.length > 30 ? clean.substring(0, 30) : clean;
}

// --- Inventory ---

function getInventoryHeaders_() {
  return [
    "Item ID", "Asset Code", "Item Name", "Brand Name", "Model", "Serial Number",
    "Category", "Status", "Quantity", "Min Stock",
    "Employee ID", "Assignee Name", "Assignee Email", "Contact Number",
    "Updated Date"
  ];
}

function inventoryFieldMap_(item, now) {
  var isAssigned = String(item.status || "Available").trim() === "Assigned";
  return {
    "Item ID": String(item.itemId || "").trim().toUpperCase(),
    "Asset Code": String(item.assetCode || "").trim().toUpperCase(),
    "Item Name": String(item.itemName || "").trim(),
    "Brand Name": String(item.brandName || "").trim(),
    "Model": String(item.model || "").trim(),
    "Serial Number": String(item.serialNumber || "").trim().toUpperCase(),
    "Category": String(item.category || "IT Assets").trim(),
    "Status": String(item.status || "Available").trim(),
    "Quantity": Number(item.quantity) || 0,
    "Min Stock": Number(item.minStock) || 0,
    "Employee ID": isAssigned ? String(item.employeeId || "").trim() : "",
    "Assignee Name": isAssigned ? String(item.assigneeName || "").trim() : "",
    "Assignee Email": isAssigned ? String(item.assigneeEmail || "").trim() : "",
    "Contact Number": isAssigned ? String(item.assigneeMobile || "").trim() : "",
    "Updated Date": item.updatedAt ? String(item.updatedAt) : (now || new Date().toISOString())
  };
}

function inventoryRowFromItem_(item, headers, now) {
  var map = inventoryFieldMap_(item, now);
  var row = [];
  for (var h = 0; h < headers.length; h++) {
    row.push(map[headers[h]] !== undefined ? map[headers[h]] : "");
  }
  return row;
}

function listInventory_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Inventory");
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var list = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var item = {};
    for (var h = 0; h < headers.length; h++) {
      item[headers[h]] = row[h];
    }
    list.push({
      itemId: String(item["Item ID"] || "").trim().toUpperCase(),
      assetCode: String(item["Asset Code"] || "").trim().toUpperCase(),
      itemName: String(item["Item Name"] || "").trim(),
      brandName: String(item["Brand Name"] || "").trim(),
      model: String(item["Model"] || "").trim(),
      serialNumber: String(item["Serial Number"] || "").trim().toUpperCase(),
      category: String(item["Category"] || "IT Assets").trim(),
      status: String(item["Status"] || "Available").trim(),
      quantity: Number(item["Quantity"]) || 0,
      minStock: Number(item["Min Stock"]) || 0,
      employeeId: String(item["Employee ID"] || "").trim(),
      assigneeName: String(item["Assignee Name"] || "").trim(),
      assigneeEmail: String(item["Assignee Email"] || "").trim(),
      assigneeMobile: String(item["Contact Number"] || "").trim(),
      updatedAt: String(item["Updated Date"] || "")
    });
  }
  return list;
}

function findInventoryRow_(itemId, assetCode) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Inventory");
  if (!sh || sh.getLastRow() < 2) return -1;
  var idStr = itemId ? normalizeId_(itemId) : "";
  var codeStr = assetCode ? normalizeId_(assetCode) : "";
  if (!idStr && !codeStr) return -1;
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var itemIdIdx = headers.indexOf("Item ID");
  var assetCodeIdx = headers.indexOf("Asset Code");
  if (itemIdIdx === -1) itemIdIdx = 0;
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (idStr && itemIdIdx !== -1 && normalizeId_(row[itemIdIdx]) === idStr) {
      return i + 1;
    }
    if (codeStr && assetCodeIdx !== -1 && normalizeId_(row[assetCodeIdx]) === codeStr) {
      return i + 1;
    }
  }
  return -1;
}

function addInventoryItem_(item) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Inventory");
  ensureSheetHeaders_(sh, getInventoryHeaders_());
  var id = String(item.itemId || "").trim().toUpperCase();
  var assetCode = String(item.assetCode || "").trim().toUpperCase();
  if (!id) return { error: "Item ID required" };
  if (findInventoryRow_(id, assetCode) !== -1) return { error: "Item ID or Asset Code already exists" };
  var now = new Date().toISOString();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.appendRow(inventoryRowFromItem_(item, headers, now));
  return { success: true, item: item };
}

function updateInventoryItem_(item) {
  var row = findInventoryRow_(item.itemId);
  if (row === -1) return addInventoryItem_(item);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Inventory");
  ensureSheetHeaders_(sh, getInventoryHeaders_());
  var now = new Date().toISOString();
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(row, 1, 1, headers.length).setValues([inventoryRowFromItem_(item, headers, now)]);
  return { success: true, item: item };
}

function deleteInventoryItem_(item) {
  var row = findInventoryRow_(item.itemId);
  if (row === -1) return { error: "Item not found" };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("Inventory").deleteRow(row);
  return { success: true };
}

function replaceInventory_(items) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Inventory");
  ensureSheetHeaders_(sh, getInventoryHeaders_());
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  clearSheetDataRows_(sh);
  if (!items || !items.length) return { success: true, count: 0 };
  var now = new Date().toISOString();
  var rows = [];
  for (var i = 0; i < items.length; i++) {
    rows.push(inventoryRowFromItem_(items[i], headers, now));
  }
  sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
  return { success: true, count: rows.length };
}

function listRedesignedTable_(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2) return [];
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var rows = data.slice(1);
  var list = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var h = 0; h < headers.length; h++) {
      obj[headers[h]] = row[h];
    }
    list.push(obj);
  }
  return list;
}

function findRowIndexByKeyValue_(sheetName, keyName, keyValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return -1;
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var keyColIndex = indexOfNormalized_(headers, keyName);
  if (keyColIndex === -1) return -1;
  var targetVal = String(keyValue || "").trim().toLowerCase();
  var targetId = normalizeId_(keyValue);
  for (var i = 1; i < data.length; i++) {
    var cellVal = String(data[i][keyColIndex] || "").trim().toLowerCase();
    if (cellVal === targetVal || normalizeId_(data[i][keyColIndex]) === targetId) {
      return i + 1;
    }
  }
  return -1;
}

function addRedesignedRow_(sheetName, rowData, primaryKeyName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { error: "Sheet " + sheetName + " not found" };

  var headers = sh.getDataRange().getValues()[0];
  var newRow = new Array(headers.length).fill("");

  for (var key in rowData) {
    var idx = headers.indexOf(key);
    if (idx !== -1) {
      newRow[idx] = rowData[key];
    }
  }

  var pkValue = rowData[primaryKeyName];
  if (pkValue && findRowIndexByKeyValue_(sheetName, primaryKeyName, pkValue) !== -1) {
    return { error: "Duplicate primary key value: " + pkValue };
  }

  sh.appendRow(newRow);
  if (sheetName === "Assets") {
    syncLocationAndPlantAssetSheets_(ss);
  }
  return { success: true, message: "Row added to " + sheetName };
}

function updateRedesignedRow_(sheetName, primaryKeyValue, rowData, primaryKeyName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { error: "Sheet " + sheetName + " not found" };

  var rowNum = findRowIndexByKeyValue_(sheetName, primaryKeyName, primaryKeyValue);
  if (rowNum === -1) {
    return addRedesignedRow_(sheetName, rowData, primaryKeyName);
  }

  var headers = sh.getDataRange().getValues()[0];
  var rowValues = sh.getRange(rowNum, 1, 1, headers.length).getValues()[0];

  for (var key in rowData) {
    var idx = headers.indexOf(key);
    if (idx !== -1) {
      rowValues[idx] = rowData[key];
    }
  }

  sh.getRange(rowNum, 1, 1, headers.length).setValues([rowValues]);
  if (sheetName === "Assets") {
    syncLocationAndPlantAssetSheets_(ss);
  }
  return { success: true, message: "Row updated in " + sheetName };
}

function deleteRedesignedRow_(sheetName, primaryKeyValue, primaryKeyName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return { error: "Sheet " + sheetName + " not found" };

  var rowNum = findRowIndexByKeyValue_(sheetName, primaryKeyName, primaryKeyValue);
  if (rowNum === -1) return { error: "Row not found in " + sheetName };

  sh.deleteRow(rowNum);
  if (sheetName === "Assets") {
    syncLocationAndPlantAssetSheets_(ss);
  }
  return { success: true, message: "Row deleted from " + sheetName };
}

function ensureLocationsPlantsSheets_(ss) {
  var locHeaders = ["Location Name", "Department", "Created Date"];
  var plantHeaders = ["Plant Code", "Plant Name", "Location Name", "Created Date"];

  var locSh = ss.getSheetByName("Locations");
  if (!locSh) {
    locSh = ss.insertSheet("Locations");
    locSh.getRange(1, 1, 1, locHeaders.length).setValues([locHeaders]);
    locSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(locSh, locHeaders);
  }

  var plantSh = ss.getSheetByName("Plants");
  if (!plantSh) {
    plantSh = ss.insertSheet("Plants");
    plantSh.getRange(1, 1, 1, plantHeaders.length).setValues([plantHeaders]);
    plantSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(plantSh, plantHeaders);
  }

  var styleSheets = [locSh, plantSh];
  for (var s = 0; s < styleSheets.length; s++) {
    var sh = styleSheets[s];
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      var hr = sh.getRange(1, 1, 1, lastCol);
      hr.setBackground("#0f766e");
      hr.setFontColor("#ffffff");
      hr.setFontWeight("bold");
    }
  }
}

function listLocationsFromSheet_() {
  var rows = listRedesignedTable_("Locations");
  var out = [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var name = String(rows[i]["Location Name"] || "").trim();
    if (!name || seen[name]) continue;
    seen[name] = true;
    out.push(name);
  }
  return out;
}

function listPlantsFromSheet_() {
  var rows = listRedesignedTable_("Plants");
  var out = [];
  var seen = {};
  for (var i = 0; i < rows.length; i++) {
    var code = String(rows[i]["Plant Code"] || "").trim();
    if (!code || seen[code]) continue;
    seen[code] = true;
    out.push({
      code: code,
      name: String(rows[i]["Plant Name"] || code).trim(),
      location: String(rows[i]["Location Name"] || "").trim()
    });
  }
  return out;
}

function syncLocationsPlantsSheets_(locations, plants) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureLocationsPlantsSheets_(ss);

  var locSh = ss.getSheetByName("Locations");
  var plantSh = ss.getSheetByName("Plants");
  if (!locSh || !plantSh) return { error: "Locations or Plants sheet missing" };

  clearSheetDataRows_(locSh);
  clearSheetDataRows_(plantSh);

  var nowStr = new Date().toISOString();
  var locList = locations || [];
  for (var i = 0; i < locList.length; i++) {
    var locName = String(locList[i] || "").trim();
    if (!locName) continue;
    locSh.appendRow([locName, "", nowStr]);
  }

  var plantList = plants || [];
  for (var p = 0; p < plantList.length; p++) {
    var item = plantList[p];
    var code = String(item.code || item["Plant Code"] || "").trim();
    if (!code) continue;
    var name = String(item.name || item["Plant Name"] || code).trim();
    var location = String(item.location || item["Location Name"] || "").trim();
    plantSh.appendRow([code, name, location, nowStr]);
  }

  syncLocationAndPlantAssetSheets_(ss);

  return {
    success: true,
    message: "Locations and Plants sheets updated; location/plant view tabs created/ refreshed",
    locations: listLocationsFromSheet_(),
    plants: listPlantsFromSheet_()
  };
}
function clearSheetDataRows_(sh) {
  if (!sh) return;
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
}

/** Collect all category + mirror asset rows as master-format rows for location/plant tabs. */
function collectMirrorAssetRows_(ss) {
  var masterHeaders = getMasterHeaders_();
  var rows = [];
  var seenKeys = {};
  var allAssets = [masterHeaders.slice()];
  var sheets = listAssetDataSheets_(ss);

  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    if (!isCategorySheetName_(sh.getName())) continue;
    var canonicalMain = SHEET_TO_MAIN_CATEGORY_[sh.getName()] || sh.getName();
    appendAssetsFromSheet_(sh, masterHeaders, allAssets, seenKeys, canonicalMain);
  }

  var redesigned = ss.getSheetByName("Assets");
  if (redesigned && redesigned.getLastRow() > 1) {
    appendAssetsFromSheet_(redesigned, masterHeaders, allAssets, seenKeys, null);
  }

  for (var r = 1; r < allAssets.length; r++) {
    rows.push(allAssets[r]);
  }

  return { headers: masterHeaders, rows: rows, masterHeaders: masterHeaders };
}

/**
 * Create/update one tab per Location and Plant (tab name = location name / plant code).
 * Each tab lists assets filtered for that location or plant (59 cols for IT-style master headers).
 */
function syncLocationAndPlantAssetSheets_(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureLocationsPlantsSheets_(ss);

  var locs = [];
  var locSh = ss.getSheetByName("Locations");
  if (locSh && locSh.getLastRow() > 1) {
    var locData = locSh.getDataRange().getValues();
    var locHeaders = locData[0];
    var nameIdx = locHeaders.indexOf("Location Name");
    if (nameIdx !== -1) {
      for (var i = 1; i < locData.length; i++) {
        var locName = String(locData[i][nameIdx] || "").trim();
        if (locName) locs.push(locName);
      }
    }
  }

  var plants = [];
  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var plantData = plantSh.getDataRange().getValues();
    var plantHeaders = plantData[0];
    var codeIdx = plantHeaders.indexOf("Plant Code");
    var plantNameIdx = plantHeaders.indexOf("Plant Name");
    if (codeIdx !== -1) {
      for (var p = 1; p < plantData.length; p++) {
        var code = String(plantData[p][codeIdx] || "").trim();
        if (code) plants.push({
          code: code,
          name: plantNameIdx !== -1 ? String(plantData[p][plantNameIdx] || "").trim() : ""
        });
      }
    }
  }

  var collected = collectMirrorAssetRows_(ss);
  if (!collected.headers) return;

  var mirrorHeaders = collected.headers;
  var mirrorRows = collected.rows;
  var masterHeaders = collected.masterHeaders;
  var assetLocIdx = indexOfNormalized_(mirrorHeaders, "Location");
  var assetPlantNameIdx = indexOfNormalized_(mirrorHeaders, "Plant Name");
  var assetPlantCodeIdx = indexOfNormalized_(mirrorHeaders, "Plant Code");

  var syncTab = function (tabName, filterFn, headerColor) {
    var sanitizedName = sanitizeSheetName_(tabName);
    if (!sanitizedName) return;
    var sh = ss.getSheetByName(sanitizedName);
    if (!sh) {
      sh = ss.insertSheet(sanitizedName);
    }
    sh.getRange(1, 1, 1, mirrorHeaders.length).setValues([mirrorHeaders]);
    sh.setFrozenRows(1);
    var hr = sh.getRange(1, 1, 1, mirrorHeaders.length);
    hr.setBackground(headerColor || "#0284c7");
    hr.setFontColor("#ffffff");
    hr.setFontWeight("bold");

    if (sh.getLastRow() > 1) {
      sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(sh.getLastColumn(), mirrorHeaders.length)).clearContent();
    }

    var matchingRows = [];
    for (var r = 0; r < mirrorRows.length; r++) {
      if (filterFn(mirrorRows[r])) matchingRows.push(mirrorRows[r]);
    }
    if (matchingRows.length > 0) {
      sh.getRange(2, 1, matchingRows.length, mirrorHeaders.length).setValues(matchingRows);
    }
  };

  var rowLoc = function (row) {
    if (assetLocIdx !== -1 && row[assetLocIdx] !== undefined) {
      return String(row[assetLocIdx] || "").trim();
    }
    return masterVal_(row, masterHeaders, "Location");
  };

  var rowPlantValues = function (row) {
    var values = [];
    if (assetPlantNameIdx !== -1 && row[assetPlantNameIdx] !== undefined) {
      values.push(String(row[assetPlantNameIdx] || "").trim());
    }
    if (assetPlantCodeIdx !== -1 && row[assetPlantCodeIdx] !== undefined) {
      values.push(String(row[assetPlantCodeIdx] || "").trim());
    }
    return values;
  };

  for (var l = 0; l < locs.length; l++) {
    (function (name) {
      syncTab(name, function (row) {
        return rowLoc(row).toUpperCase() === name.toUpperCase();
      }, "#0284c7");
    })(locs[l]);
  }

  for (var pi = 0; pi < plants.length; pi++) {
    (function (plant) {
      syncTab(plant.code, function (row) {
        var values = rowPlantValues(row);
        for (var v = 0; v < values.length; v++) {
          var value = String(values[v] || "").trim().toUpperCase();
          if (value === plant.code.toUpperCase() || (plant.name && value === plant.name.toUpperCase())) return true;
        }
        return false;
      }, "#0f766e");
    })(plants[pi]);
  }
}

function updateFieldInCategorySheets_(fieldName, oldValue, newValue) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  for (var c = 0; c < CATEGORIES.length; c++) {
    var sh = ss.getSheetByName(CATEGORIES[c]);
    if (!sh || sh.getLastRow() < 2) continue;
    var data = sh.getDataRange().getValues();
    var idx = indexOfNormalized_(data[0], fieldName);
    if (idx === -1) continue;
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][idx] || "").trim() === oldValue) {
        sh.getRange(i + 1, idx + 1).setValue(newValue);
      }
    }
  }
}

function renameLocationInSheets_(oldName, newName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var oldTabName = sanitizeSheetName_(oldName);
  var newTabName = sanitizeSheetName_(newName);
  if (oldTabName && newTabName && oldTabName !== newTabName) {
    var oldSheet = ss.getSheetByName(oldTabName);
    if (oldSheet) {
      var targetSheet = ss.getSheetByName(newTabName);
      if (targetSheet) {
        ss.deleteSheet(oldSheet);
      } else {
        oldSheet.setName(newTabName);
      }
    }
  }

  updateFieldInCategorySheets_("Location", oldName, newName);

  var locSh = ss.getSheetByName("Locations");
  if (locSh && locSh.getLastRow() > 1) {
    var data = locSh.getDataRange().getValues();
    var headers = data[0];
    var nameIdx = headers.indexOf("Location Name");
    if (nameIdx !== -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][nameIdx] || "").trim() === oldName) {
          locSh.getRange(i + 1, nameIdx + 1).setValue(newName);
        }
      }
    }
  }

  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var data = plantSh.getDataRange().getValues();
    var headers = data[0];
    var plantLocIdx = headers.indexOf("Location Name");
    if (plantLocIdx !== -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][plantLocIdx] || "").trim() === oldName) {
          plantSh.getRange(i + 1, plantLocIdx + 1).setValue(newName);
        }
      }
    }
  }

  syncLocationAndPlantAssetSheets_(ss);
  return { success: true };
}

function deleteLocationInSheets_(name, deleteOrArchive) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabName = sanitizeSheetName_(name);
  if (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (sh) {
      if (deleteOrArchive === "archive") {
        var archivedName = sanitizeSheetName_("ARCHIVED_" + tabName);
        var existingArchive = ss.getSheetByName(archivedName);
        if (existingArchive) {
          ss.deleteSheet(existingArchive);
        }
        sh.setName(archivedName);
      } else {
        ss.deleteSheet(sh);
      }
    }
  }

  var locSh = ss.getSheetByName("Locations");
  if (locSh && locSh.getLastRow() > 1) {
    var data = locSh.getDataRange().getValues();
    var headers = data[0];
    var nameIdx = headers.indexOf("Location Name");
    if (nameIdx !== -1) {
      for (var i = data.length - 1; i >= 1; i--) {
        if (String(data[i][nameIdx] || "").trim() === name) {
          locSh.deleteRow(i + 1);
        }
      }
    }
  }

  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var data = plantSh.getDataRange().getValues();
    var headers = data[0];
    var plantLocIdx = headers.indexOf("Location Name");
    if (plantLocIdx !== -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][plantLocIdx] || "").trim() === name) {
          plantSh.getRange(i + 1, plantLocIdx + 1).setValue("");
        }
      }
    }
  }

  updateFieldInCategorySheets_("Location", name, "");

  syncLocationAndPlantAssetSheets_(ss);
  return { success: true };
}

function renamePlantInSheets_(oldCode, newCode, newName, location) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var oldTabName = sanitizeSheetName_(oldCode);
  var newTabName = sanitizeSheetName_(newCode);
  if (oldTabName && newTabName && oldTabName !== newTabName) {
    var oldSheet = ss.getSheetByName(oldTabName);
    if (oldSheet) {
      var targetSheet = ss.getSheetByName(newTabName);
      if (targetSheet) {
        ss.deleteSheet(oldSheet);
      } else {
        oldSheet.setName(newTabName);
      }
    }
  }

  updateFieldInCategorySheets_("Plant Name", oldCode, newCode);

  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var data = plantSh.getDataRange().getValues();
    var headers = data[0];
    var codeIdx = headers.indexOf("Plant Code");
    var nameIdx = headers.indexOf("Plant Name");
    var locIdx = headers.indexOf("Location Name");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][codeIdx] || "").trim() === oldCode) {
        if (codeIdx !== -1) plantSh.getRange(i + 1, codeIdx + 1).setValue(newCode);
        if (nameIdx !== -1) plantSh.getRange(i + 1, nameIdx + 1).setValue(newName);
        if (locIdx !== -1) plantSh.getRange(i + 1, locIdx + 1).setValue(location || "");
      }
    }
  }

  syncLocationAndPlantAssetSheets_(ss);
  return { success: true };
}

function deletePlantInSheets_(code, deleteOrArchive) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabName = sanitizeSheetName_(code);
  if (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (sh) {
      if (deleteOrArchive === "archive") {
        var archivedName = sanitizeSheetName_("ARCHIVED_" + tabName);
        var existingArchive = ss.getSheetByName(archivedName);
        if (existingArchive) ss.deleteSheet(existingArchive);
        sh.setName(archivedName);
      } else {
        ss.deleteSheet(sh);
      }
    }
  }

  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var data = plantSh.getDataRange().getValues();
    var headers = data[0];
    var codeIdx = headers.indexOf("Plant Code");
    if (codeIdx !== -1) {
      for (var i = data.length - 1; i >= 1; i--) {
        if (String(data[i][codeIdx] || "").trim() === code) plantSh.deleteRow(i + 1);
      }
    }
  }

  syncLocationAndPlantAssetSheets_(ss);
  return { success: true };
}

// ============================================================
// Spreadsheet menu (AEMS) — must live in WebApp.gs project file
// ============================================================

/** Runs when the spreadsheet is opened — shows AEMS menu in menu bar. */
function onOpen() {
  buildAemsMenu_();
}

/**
 * Run ONCE from Apps Script editor if AEMS menu never appears after opening sheet:
 * Select installAemsOnOpenTrigger > Run > Allow permissions > reopen Google Sheet.
 * Do NOT run buildAemsMenu_ from editor — getUi() only works when the sheet is open in browser.
 */
function installAemsOnOpenTrigger() {
  var ss = SpreadsheetApp.getActive();
  if (!ss) {
    throw new Error("Open your Google Sheet first, then run installAemsOnOpenTrigger from Extensions > Apps Script.");
  }
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onOpen") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger("onOpen").forSpreadsheet(ss).onOpen().create();
  Logger.log("AEMS onOpen trigger installed. Close the sheet tab and open it again — AEMS menu should appear.");
}

/** Creates AEMS menu — only works when Google Sheet is open (onOpen), not from script editor Run. */
function buildAemsMenu_() {
  try {
    SpreadsheetApp.getUi()
      .createMenu("AEMS")
      .addItem("Setup All Sheets (correct fields)", "runSetupSheetsMenu_")
      .addSeparator()
      .addItem("Sync location & plant view sheets", "runSyncLocationPlantMenu_")
      .addSeparator()
      .addItem("Refresh AEMS menu", "buildAemsMenu_")
      .addToUi();
  } catch (err) {
    Logger.log(
      "buildAemsMenu_: Menu can only load when the Sheet is open in browser (not from Run in editor). " +
        "Refresh the sheet tab (F5) or run installAemsOnOpenTrigger once. Detail: " +
        err
    );
  }
}

function runSetupSheetsMenu_() {
  if (typeof setupSheets === "function") {
    setupSheets();
    return;
  }
  SpreadsheetApp.getUi().alert(
    "setupSheets not found.\n\nIn Apps Script, add code.gs (same project as WebApp.gs), save, then try again.\n\nOr run: Extensions > Apps Script > Run > setupSheets"
  );
}

function runSyncLocationPlantMenu_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  syncLocationAndPlantAssetSheets_(ss);
  SpreadsheetApp.getUi().alert("Location & plant view sheets refreshed.");
}
