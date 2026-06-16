/**
 * AssestFlow — Complete Google Apps Script Backend
 * Deploy: Execute as Me | Who has access: Anyone
 * Spreadsheet: 1OW6T1SSVOn5NfaNlqJWKPg4bxChrzIh0MP0t6c2HQ38
 * Users tab gid: 1792788791
 */

var USERS_SHEET_GID = 1792788791;
var OTP_TTL_MS = 10 * 60 * 1000;
var MAX_OTP_ATTEMPTS = 5;

// Custom sender (Gmail "Send mail as" alias)
var SENDER_EMAIL = "verify.software2040@pgel.in";
var SENDER_NAME = "PG GROUP SOFTWARE SYSTEM";

// ============================================================
// 1. AUTO SETUP — Category Expansion
// ============================================================

var CATEGORIES = [
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

/** Rename legacy category sheet tabs without losing data */
function migrateCategorySheetNames_(ss) {
  var renames = {
    "Production Manufacturing Assets": "Production Assets",
    "Production / Manufacturing Assets": "Production Assets",
    "Maintenance Tools": "Maintenance Assets"
  };
  for (var oldName in renames) {
    var sh = ss.getSheetByName(oldName);
    if (!sh) continue;
    var newName = renames[oldName];
    if (!ss.getSheetByName(newName)) {
      sh.setName(newName);
    }
  }
}

var CATEGORY_HEADERS = [
  "Asset ID", "Asset Code", "Asset Name", "Main Category", "Sub Category",
  "Brand", "Model", "Serial Number", "Quantity", "Plant Name",
  "Location", "Department", "Assigned To", "Employee ID", "Purchase Date",
  "Purchase Cost", "Vendor Name", "Invoice Number", "Warranty Start Date", "Warranty Expiry Date",
  "Condition", "Status", "Maintenance Required", "Last Maintenance Date", "Next Maintenance Date",
  "Photo URL / Photo Upload", "Document URL / Attached Documents", "QR Code / Barcode", "Remarks",
  "Created By", "Created Date", "Updated By", "Updated Date",
  "Contact Email", "Contact Number"
];

var IT_EXTRA_HEADERS = [
  "RAM", "SSD", "CPU", "Windows Version", "MAC Address", "Unique Code", "Binary Code",
  "Monitor Serial", "Monitor Asset Code",
  "Keyboard Serial", "Keyboard Asset Code",
  "Mouse Serial", "Mouse Asset Code",
  "UPS Serial", "UPS Asset Code"
];

var CATEGORY_SHEET_MAP_ = {
  "IT Assets": "IT Assets",
  "Office Assets": "Office Assets",
  "Electrical Assets": "Electrical Assets",
  "Production Assets": "Production Assets",
  "Production / Manufacturing Assets": "Production Assets",
  "Production Manufacturing Assets": "Production Assets",
  "Safety Assets": "Safety Assets",
  "Vehicle Assets": "Vehicle Assets",
  "Furniture Assets": "Furniture Assets",
  "Software / License Assets": "Software License Assets",
  "Admin / Facility Assets": "Admin Facility Assets",
  "Maintenance Assets": "Maintenance Assets",
  "Maintenance Tools": "Maintenance Assets"
};

function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  migrateCategorySheetNames_(ss);
  var assetHeaders = CATEGORY_HEADERS.slice();
  var itHeaders = CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS);

  for (var c = 0; c < CATEGORIES.length; c++) {
    var cat = CATEGORIES[c];
    var sh = ss.getSheetByName(cat);
    var headers = cat === "IT Assets" ? itHeaders : assetHeaders;
    if (!sh) {
      sh = ss.insertSheet(cat);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      ensureSheetHeaders_(sh, headers);
    }
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      var hr = sh.getRange(1, 1, 1, lastCol);
      hr.setBackground("#1a73e8");
      hr.setFontColor("#ffffff");
      hr.setFontWeight("bold");
    }
    sh.setFrozenRows(1);
  }

  // Migrate old data from Bhiwadi or Asset Info to IT Assets if IT Assets has no assets
  var itSheet = ss.getSheetByName("IT Assets");
  if (itSheet && itSheet.getLastRow() === 1) {
    var oldSheet = null;
    var sheets = ss.getSheets();
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName().toLowerCase();
      if (name === "bhiwadi" || name === "asset info" || name === "assetinfo") {
        oldSheet = sheets[i];
        break;
      }
    }
    if (oldSheet && oldSheet.getLastRow() > 1) {
      var oldData = oldSheet.getDataRange().getValues();
      var oldHeaders = oldData[0];
      var oldRows = oldData.slice(1);
      
      var mappedRows = [];
      for (var r = 0; r < oldRows.length; r++) {
        var row = oldRows[r];
        var item = {};
        for (var h = 0; h < oldHeaders.length; h++) {
          item[oldHeaders[h]] = row[h];
        }
        
        var newRow = new Array(itHeaders.length).fill("");
        var setValByName = function(name, val) {
          var idx = itHeaders.indexOf(name);
          if (idx !== -1) newRow[idx] = val;
        };
        
        setValByName("Asset ID", item["S No"] || item["ID"] || "");
        setValByName("Asset Code", item["Asset Code"] || "");
        
        var make = item["Make"] || item["Brand"] || "";
        var model = item["Model"] || "";
        var type = item["Asset Type"] || item["Type"] || "";
        setValByName("Asset Name", type ? (make + " " + model + " (" + type + ")") : (make + " " + model));
        setValByName("Main Category", "IT Assets");
        
        var subCat = "Other IT Asset";
        var tLower = String(type).toLowerCase();
        if (tLower.indexOf("laptop") !== -1 || tLower.indexOf("desktop") !== -1) subCat = "Laptop / Desktop";
        else if (tLower.indexOf("keyboard") !== -1 || tLower.indexOf("mouse") !== -1 || tLower.indexOf("scanner") !== -1) subCat = "Input Device";
        else if (tLower.indexOf("monitor") !== -1) subCat = "Output Device";
        else if (tLower.indexOf("switch") !== -1 || tLower.indexOf("rack") !== -1 || tLower.indexOf("access point") !== -1 || tLower.indexOf("firewall") !== -1 || tLower.indexOf("controller") !== -1) subCat = "Network Device";
        else if (tLower.indexOf("hdd") !== -1 || tLower.indexOf("ssd") !== -1) subCat = "Storage Device";
        else if (tLower.indexOf("printer") !== -1) subCat = "Printer / Scanner";
        else if (tLower.indexOf("camera") !== -1 || tLower.indexOf("nvr") !== -1) subCat = "CCTV / Security Device";
        else if (tLower.indexOf("ups") !== -1) subCat = "Server / UPS";
        setValByName("Sub Category", subCat);
        
        setValByName("Brand", make);
        setValByName("Model", model);
        setValByName("Serial Number", item["Serial Number"] || item["SN"] || "");
        setValByName("Quantity", "1");
        setValByName("Plant Name", item["Plant"] || item["Plant Code"] || "");
        setValByName("Location", item["Location"] || "");
        setValByName("Department", item["Department"] || "");
        setValByName("Assigned To", item["Contact Person Name"] || item["Owner"] || "");
        setValByName("Vendor Name", item["Vendor Name"] || "");
        setValByName("Warranty Start Date", item["Warranty Start"] || "");
        setValByName("Warranty Expiry Date", item["Warranty End"] || "");
        setValByName("Condition", "Good");
        setValByName("Status", "Assigned");
        setValByName("Photo URL / Photo Upload", item["Asset Image"] || "");
        setValByName("Document URL / Attached Documents", item["Document Link"] || "");
        setValByName("QR Code / Barcode", item["QR Code Text"] || "");
        setValByName("Remarks", item["Additional Items"] || "");
        
        setValByName("RAM", item["RAM"] || "");
        setValByName("SSD", item["SSD"] || "");
        setValByName("CPU", item["CPU"] || "");
        setValByName("Windows Version", item["Windows Version"] || "");
        setValByName("MAC Address", item["MAC Address"] || "");
        setValByName("Unique Code", item["Unique Code"] || "");
        setValByName("Binary Code", item["Binary Code"] || "");
        setValByName("Monitor Serial", item["Monitor Serial"] || "");
        setValByName("Monitor Asset Code", item["Monitor Asset Code"] || "");
        setValByName("Keyboard Serial", item["Keyboard Serial"] || "");
        setValByName("Keyboard Asset Code", item["Keyboard Asset Code"] || "");
        setValByName("Mouse Serial", item["Mouse Serial"] || "");
        setValByName("Mouse Asset Code", item["Mouse Asset Code"] || "");
        setValByName("UPS Serial", item["UPS Serial"] || "");
        setValByName("UPS Asset Code", item["UPS Asset Code"] || "");
        
        mappedRows.push(newRow);
      }
      
      if (mappedRows.length > 0) {
        itSheet.getRange(2, 1, mappedRows.length, itHeaders.length).setValues(mappedRows);
      }
    }
  }

  // Set up users
  var usersSheet = getUsersSheet_();
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
  }

  var userHeaders = ["Email", "Role", "Locations", "Plants", "Categories", "OTP", "Expiry", "Attempts"];
  ensureSheetHeaders_(usersSheet, userHeaders);
  var lastCol = usersSheet.getLastColumn();
  if (lastCol > 0) {
    var ur = usersSheet.getRange(1, 1, 1, lastCol);
    ur.setBackground("#0d9488");
    ur.setFontColor("#ffffff");
    ur.setFontWeight("bold");
  }
  usersSheet.setFrozenRows(1);
  if (usersSheet.getLastRow() === 1) {
    var adminRow = new Array(userHeaders.length).fill("");
    var idx = findUserRowIndexes_(userHeaders);
    if (idx.email !== -1) adminRow[idx.email] = "admin@example.com";
    if (idx.role !== -1) adminRow[idx.role] = "IT Admin";
    if (idx.loc !== -1) adminRow[idx.loc] = "All";
    if (idx.plant !== -1) adminRow[idx.plant] = "All";
    if (idx.categories !== -1) adminRow[idx.categories] = "All";
    if (idx.attempts !== -1) adminRow[idx.attempts] = 0;
    usersSheet.appendRow(adminRow);
  }

  // Set IT Admin categories to "All" if empty
  var userData = usersSheet.getDataRange().getValues();
  var uIdx = findUserRowIndexes_(userData[0]);
  if (uIdx.email !== -1 && uIdx.categories !== -1 && uIdx.role !== -1) {
    for (var r = 1; r < userData.length; r++) {
      var role = String(userData[r][uIdx.role] || "").trim();
      var cats = String(userData[r][uIdx.categories] || "").trim();
      if (role === "IT Admin" && !cats) {
        usersSheet.getRange(r + 1, uIdx.categories + 1).setValue("All");
      }
    }
  }

  var optionsSheet = ss.getSheetByName("Options");
  if (!optionsSheet) {
    optionsSheet = ss.insertSheet("Options");
    optionsSheet.getRange(1, 1, 1, 2).setValues([["Type", "Value"]]);
    optionsSheet.getRange(2, 1, 5, 2).setValues([
      ["Location", "Head Office"],
      ["Location", "Branch Office"],
      ["Plant", "P101"],
      ["Department", "IT"],
      ["Department", "Engineering"]
    ]);
  }

  ensureMetaSheets_(ss);

  try {
    SpreadsheetApp.getUi().alert("AssestFlow company-level expansion setup complete.");
  } catch (e) {
    Logger.log("AssestFlow company-level expansion setup complete.");
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
    invSh.getRange(1, 1, 1, 10).setValues([[
      "Item ID", "Item Name", "Brand Name", "Model", "Serial Number", "Category", "Status", "Quantity", "Min Stock", "Updated Date"
    ]]);
    invSh.setFrozenRows(1);
  } else {
    ensureSheetHeaders_(invSh, [
      "Item ID", "Item Name", "Brand Name", "Model", "Serial Number", "Category", "Status", "Quantity", "Min Stock", "Updated Date"
    ]);
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

function setupSheetsOnFirstRun_(ss) {
  var itSheet = ss.getSheetByName("IT Assets");
  if (!itSheet) {
    setupSheets();
  }
}

// ============================================================
// 2. GET
// ============================================================

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = e && e.parameter && e.parameter.action ? e.parameter.action : "";
    var type = e && e.parameter && e.parameter.type ? e.parameter.type : "assets";

    if (action === "list_users" || action === "get_users" || type === "users") {
      return json_(listUsersFromSheet_());
    }

    if (action === "get_asset_details") {
      return json_({ success: true, details: getAssetDetailsMap_() });
    }
    if (action === "get_type_definitions") {
      return json_({ success: true, types: getTypeDefinitions_() });
    }
    if (action === "list_employees") {
      return json_({ success: true, employees: listEmployees_() });
    }
    if (action === "get_assignment_history") {
      return json_({ success: true, history: getAssignmentHistory_() });
    }
    if (action === "list_inventory") {
      return json_({ success: true, inventory: listInventory_() });
    }
    if (action === "list_assets_redesigned") {
      return json_({ success: true, assets: listRedesignedTable_("Assets") });
    }
    if (action === "list_categories") {
      return json_({ success: true, categories: listRedesignedTable_("Categories") });
    }
    if (action === "list_asset_types") {
      return json_({ success: true, types: listRedesignedTable_("Asset_Types") });
    }
    if (action === "list_extra_items") {
      return json_({ success: true, items: listRedesignedTable_("Asset_Extra_Items") });
    }
    if (action === "list_assignments") {
      return json_({ success: true, assignments: listRedesignedTable_("Assignments") });
    }
    if (action === "list_damaged_items") {
      return json_({ success: true, items: listRedesignedTable_("Damaged_Items") });
    }
    if (action === "list_missing_items") {
      return json_({ success: true, items: listRedesignedTable_("Missing_Items") });
    }
    if (action === "list_audit_logs") {
      return json_({ success: true, logs: listRedesignedTable_("Audit_Logs") });
    }
    if (action === "list_locations_plants") {
      ensureLocationsPlantsSheets_(ss);
      return json_({
        success: true,
        locations: listLocationsFromSheet_(),
        plants: listPlantsFromSheet_()
      });
    }
    if (action === "get_asset_headers") {
      return json_({
        success: true,
        headers: CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS)
      });
    }

    if (type === "options") {
      var optionsSheet = ss.getSheetByName("Options");
      if (!optionsSheet) return json_({ success: true, options: {} });
      var data = optionsSheet.getDataRange().getValues();
      var options = {};
      for (var i = 1; i < data.length; i++) {
        var optType = data[i][0];
        var optValue = data[i][1];
        if (!options[optType]) options[optType] = [];
        options[optType].push(optValue);
      }
      return json_({ success: true, options: options });
    }

    // Read from ALL category sheets and combine them
    var allAssets = [];
    var isHeadersAdded = false;
    var headers = [];

    setupSheetsOnFirstRun_(ss);

    for (var c = 0; c < CATEGORIES.length; c++) {
      var cat = CATEGORIES[c];
      var sh = ss.getSheetByName(cat);
      if (!sh) continue;

      var data = sh.getDataRange().getValues();
      if (data.length < 2) continue;

      var sheetHeaders = data[0];
      var sheetRows = data.slice(1);

      if (!isHeadersAdded) {
        headers = CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS);
        allAssets.push(headers);
        isHeadersAdded = true;
      }

      for (var r = 0; r < sheetRows.length; r++) {
        var row = sheetRows[r];
        var mappedRow = new Array(headers.length).fill("");

        for (var h = 0; h < headers.length; h++) {
          var headerName = headers[h];
          var sourceIndex = indexOfNormalized_(sheetHeaders, headerName);
          var val = "";
          if (sourceIndex !== -1) {
            val = String(row[sourceIndex] || "").trim();
          }
          
          if (!val) {
            var fallbackIndex = -1;
            if (headerName === "Contact Email") {
              fallbackIndex = indexOfNormalized_(sheetHeaders, "Email");
              if (fallbackIndex === -1) fallbackIndex = indexOfNormalized_(sheetHeaders, "MAIL ID");
            } else if (headerName === "Contact Number") {
              fallbackIndex = indexOfNormalized_(sheetHeaders, "Mobile");
              if (fallbackIndex === -1) fallbackIndex = indexOfNormalized_(sheetHeaders, "CONTACT NUMBER");
            }
            if (fallbackIndex !== -1) {
              val = String(row[fallbackIndex] || "").trim();
            }
          }
          
          mappedRow[h] = val;
        }
        allAssets.push(mappedRow);
      }
    }

    // Empty sheets: still return header row so the app can add the first asset
    if (!isHeadersAdded) {
      headers = CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS);
      allAssets.push(headers);
    }

    return json_(allAssets);
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// ============================================================
// 3. POST
// ============================================================

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    setupSheetsOnFirstRun_(ss);

    if (action === "list_users" || action === "get_users" || action === "read_users") {
      return json_(listUsersFromSheet_());
    }
    if (action === "setup") {
      setupSheets();
      return json_({ success: true, message: "Sheets setup complete" });
    }
    if (action === "setup_redesigned") {
      setupRedesignedSheets();
      return json_({ success: true, message: "Redesigned Database Setup Complete" });
    }
    if (action === "setup_redesigned_fresh") {
      setupRedesignedSheetsFresh();
      return json_({ success: true, message: "Database reset complete. All old data cleared. Default admin and locations restored." });
    }
    if (action === "add_asset_redesigned") {
      var addDup = checkAssetIdentifierDuplicates_(body.row, null);
      if (addDup) return json_(addDup);
      return json_(addRedesignedRow_("Assets", body.row, "Asset ID"));
    }
    if (action === "update_asset_redesigned") {
      var updDup = checkAssetIdentifierDuplicates_(body.row, body.id);
      if (updDup) return json_(updDup);
      return json_(updateRedesignedRow_("Assets", body.id, body.row, "Asset ID"));
    }
    if (action === "delete_asset_redesigned") {
      return json_(deleteRedesignedRow_("Assets", body.id, "Asset ID"));
    }
    if (action === "add_category") {
      return json_(addRedesignedRow_("Categories", body.row, "Category Name"));
    }
    if (action === "update_category") {
      return json_(updateRedesignedRow_("Categories", body.id, body.row, "Category Name"));
    }
    if (action === "delete_category") {
      return json_(deleteRedesignedRow_("Categories", body.id, "Category Name"));
    }
    if (action === "add_asset_type") {
      return json_(addRedesignedRow_("Asset_Types", body.row, "Type ID"));
    }
    if (action === "delete_asset_type") {
      return json_(deleteRedesignedRow_("Asset_Types", body.id, "Type ID"));
    }
    if (action === "add_extra_item") {
      return json_(addRedesignedRow_("Asset_Extra_Items", body.row, "Record ID"));
    }
    if (action === "update_extra_item") {
      return json_(updateRedesignedRow_("Asset_Extra_Items", body.id, body.row, "Record ID"));
    }
    if (action === "delete_extra_item") {
      return json_(deleteRedesignedRow_("Asset_Extra_Items", body.id, "Record ID"));
    }
    if (action === "add_assignment") {
      return json_(addRedesignedRow_("Assignments", body.row, "Assignment ID"));
    }
    if (action === "delete_assignment") {
      return json_(deleteRedesignedRow_("Assignments", body.id, "Assignment ID"));
    }
    if (action === "add_damaged_item") {
      return json_(addRedesignedRow_("Damaged_Items", body.row, "Record ID"));
    }
    if (action === "update_damaged_item") {
      return json_(updateRedesignedRow_("Damaged_Items", body.id, body.row, "Record ID"));
    }
    if (action === "add_missing_item") {
      return json_(addRedesignedRow_("Missing_Items", body.row, "Record ID"));
    }
    if (action === "update_missing_item") {
      return json_(updateRedesignedRow_("Missing_Items", body.id, body.row, "Record ID"));
    }
    if (action === "add_audit_log") {
      return json_(addRedesignedRow_("Audit_Logs", body.row, "Log ID"));
    }
    if (action === "sync_locations_plants") {
      ensureLocationsPlantsSheets_(ss);
      return json_(syncLocationsPlantsSheets_(body.locations, body.plants));
    }
    if (action === "rename_location") {
      return json_(renameLocationInSheets_(body.oldName, body.newName));
    }
    if (action === "delete_location") {
      return json_(deleteLocationInSheets_(body.name, body.deleteOrArchive));
    }
    if (action === "rename_plant") {
      return json_(renamePlantInSheets_(body.oldCode, body.newCode, body.newName, body.location));
    }
    if (action === "delete_plant") {
      return json_(deletePlantInSheets_(body.code, body.deleteOrArchive));
    }
    if (action === "request_otp") return json_(handleRequestOtp_(ss, body));
    if (action === "verify_otp") return json_(handleVerifyOtp_(ss, body));
    if (action === "upload_file") return json_(handleFileUpload_(body));
    if (action === "get_file_base64") return json_(handleGetFileBase64_(body));

    if (action === "add") {
      var row = body.row;
      if (body.sheet === "Users" || body.sheet === "users") {
        return json_({ error: "Invalid action: 'add' is not supported for Users. Use 'add_user' instead." });
      }
      var mainCat = String(row[3] || "").trim() || "IT Assets";
      var sheetName = CATEGORY_SHEET_MAP_[mainCat] || "IT Assets";
      
      var sh = ss.getSheetByName(sheetName);
      if (!sh) {
        setupSheets();
        sh = ss.getSheetByName(sheetName);
      }
      
      var sheetHeaders = sh.getDataRange().getValues()[0];
      var newRow = new Array(sheetHeaders.length).fill("");
      
      var serial = String(row[0] || "").trim();
      if (!serial) {
        var totalRows = 0;
        for (var c = 0; c < CATEGORIES.length; c++) {
          var s = ss.getSheetByName(CATEGORIES[c]);
          if (s) totalRows += (s.getLastRow() - 1);
        }
        function padSerial_(num) { return ("000" + num).slice(-3); }
        serial = padSerial_(totalRows + 1);
        row[0] = serial;
      }

      var masterHeaders = CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS);
      for (var h = 0; h < sheetHeaders.length; h++) {
        var hName = sheetHeaders[h];
        var srcIdx = indexOfNormalized_(masterHeaders, hName);
        if (srcIdx !== -1) {
          newRow[h] = row[srcIdx];
        } else {
          var hNameNorm = String(hName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (hNameNorm === "email" || hNameNorm === "mailid") {
            var emailIdx = indexOfNormalized_(masterHeaders, "Contact Email");
            if (emailIdx !== -1) newRow[h] = row[emailIdx];
          } else if (hNameNorm === "mobile" || hNameNorm === "contactnumber") {
            var mobileIdx = indexOfNormalized_(masterHeaders, "Contact Number");
            if (mobileIdx !== -1) newRow[h] = row[mobileIdx];
          }
        }
      }

      sh.appendRow(newRow);
      return json_({ success: true, message: "Asset added", id: serial });
    }

    if (action === "update") {
      var id = String(body.id);
      var row = body.row;
      var mainCat = String(row[3] || "").trim() || "IT Assets";
      var sheetName = CATEGORY_SHEET_MAP_[mainCat] || "IT Assets";

      // Clean duplicate from other sheets if Main Category changed
      var idStr = normalizeId_(id);
      for (var c = 0; c < CATEGORIES.length; c++) {
        var catName = CATEGORIES[c];
        if (catName === sheetName) continue;
        var sh = ss.getSheetByName(catName);
        if (sh) {
          var data = sh.getDataRange().getValues();
          for (var i = 1; i < data.length; i++) {
            if (data[i][0] && normalizeId_(data[i][0]) === idStr) {
              sh.deleteRow(i + 1);
              break;
            }
          }
        }
      }

      var sh = ss.getSheetByName(sheetName);
      if (!sh) {
        setupSheets();
        sh = ss.getSheetByName(sheetName);
      }

      var data = sh.getDataRange().getValues();
      var sheetHeaders = data[0];
      var rowIndex = -1;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0] && normalizeId_(data[i][0]) === idStr) {
          rowIndex = i;
          break;
        }
      }

      var newRow = new Array(sheetHeaders.length).fill("");
      var masterHeaders = CATEGORY_HEADERS.concat(IT_EXTRA_HEADERS);
      for (var h = 0; h < sheetHeaders.length; h++) {
        var hName = sheetHeaders[h];
        var srcIdx = indexOfNormalized_(masterHeaders, hName);
        if (srcIdx !== -1) {
          newRow[h] = row[srcIdx];
        } else {
          var hNameNorm = String(hName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
          if (hNameNorm === "email" || hNameNorm === "mailid") {
            var emailIdx = indexOfNormalized_(masterHeaders, "Contact Email");
            if (emailIdx !== -1) newRow[h] = row[emailIdx];
          } else if (hNameNorm === "mobile" || hNameNorm === "contactnumber") {
            var mobileIdx = indexOfNormalized_(masterHeaders, "Contact Number");
            if (mobileIdx !== -1) newRow[h] = row[mobileIdx];
          }
        }
      }

      if (rowIndex !== -1) {
        sh.getRange(rowIndex + 1, 1, 1, newRow.length).setValues([newRow]);
      } else {
        sh.appendRow(newRow);
      }

      return json_({ success: true, message: "Asset updated" });
    }

    if (action === "save_asset_details") {
      saveAssetDetails_(String(body.assetId || ""), body.details || {});
      return json_({ success: true, message: "Asset details saved" });
    }
    if (action === "delete_asset_details") {
      deleteAssetDetails_(String(body.assetId || ""));
      return json_({ success: true, message: "Asset details removed" });
    }
    if (action === "save_type_definitions") {
      saveTypeDefinitions_(body.types || []);
      return json_({ success: true, message: "Type definitions saved" });
    }
    if (action === "add_employee") {
      return json_(addEmployee_(body.employee || {}));
    }
    if (action === "update_employee") {
      return json_(updateEmployee_(body.employee || {}));
    }
    if (action === "delete_employee") {
      return json_(deleteEmployee_(body.employee || {}));
    }
    if (action === "add_inventory_item") {
      return json_(addInventoryItem_(body.item || {}));
    }
    if (action === "update_inventory_item") {
      return json_(updateInventoryItem_(body.item || {}));
    }
    if (action === "delete_inventory_item") {
      return json_(deleteInventoryItem_(body.item || {}));
    }
    if (action === "add_assignment_history") {
      return json_(addAssignmentHistory_(body.entry || {}));
    }

    if (action === "delete") {
      var id = String(body.id);
      deleteAssetDetails_(id);
      var deletedCount = 0;
      var idStr = normalizeId_(id);
      for (var c = 0; c < CATEGORIES.length; c++) {
        var catName = CATEGORIES[c];
        var sh = ss.getSheetByName(catName);
        if (sh) {
          var data = sh.getDataRange().getValues();
          for (var i = 1; i < data.length; i++) {
            if (data[i][0] && normalizeId_(data[i][0]) === idStr) {
              sh.deleteRow(i + 1);
              deletedCount++;
              break;
            }
          }
        }
      }
      if (deletedCount === 0) return { error: "Asset not found" };
      return json_({ success: true, message: "Asset deleted from category sheet" });
    }

    if (action === "add_user" || action === "addUser" || action === "append_user") {
      return json_(addUserToSheet_(body));
    }
    if (action === "update_user" || action === "updateUser" || action === "edit_user") {
      return json_(updateUserInSheet_(body));
    }
    if (action === "delete_user" || action === "deleteUser" || action === "remove_user") {
      return json_(deleteUserFromSheet_(body));
    }

    if (action === "add_option") {
      var optSh = ss.getSheetByName("Options");
      if (!optSh) return json_({ error: "Options sheet not found" });
      optSh.appendRow([body.type, body.value]);
      return json_({ success: true, message: "Option added" });
    }
    if (action === "delete_option") {
      return json_(handleDeleteOption_(ss, body));
    }

    return json_({ error: "Unknown action: " + action });
  } catch (err) {
    return json_({ error: String(err) });
  }
}

// ============================================================
// OTP — GmailApp + custom From
// ============================================================

function normalizeEmail_(email) {
  return String(email || "").trim().toLowerCase();
}

function generateOtp_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function otpHash_(otp) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(otp))
  );
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
    '<p style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:1px">ASSESTFLOW</p>' +
    '<p style="margin:6px 0 0;color:#7b93d4;font-size:12px;letter-spacing:1px">IT Asset Management System</p>' +
    "</td></tr>" +
    '<tr><td style="height:4px;background:#1a56db"></td></tr>' +
    '<tr><td style="padding:36px 40px 28px">' +
    '<p style="margin:0 0 4px;color:#111827;font-size:16px;font-weight:700">Hello,</p>' +
    '<p style="margin:0 0 28px;color:#6b7280;font-size:14px;line-height:1.7">A login was requested for your <strong>AssestFlow</strong> account. Enter the code below to verify your identity.</p>' +
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
    '<p style="margin:0 0 3px;color:#9ca3af;font-size:11px">Automated message from AssestFlow — do not reply.</p>' +
    '<p style="margin:0;color:#d1d5db;font-size:11px">&copy; ' +
    year +
    " PG Group. All rights reserved.</p></td></tr>" +
    "</table></td></tr></table></body></html>"
  );
}

function findUserRowIndexes_(headers) {
  var norm = headers.map(function (h) {
    return String(h).toLowerCase().trim();
  });
  var catIdx = norm.indexOf("categories");
  if (catIdx === -1) catIdx = norm.indexOf("access");
  return {
    email: norm.indexOf("email"),
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
  if (!usersSheet) return { error: "Users sheet not found. Run setupSheets() first." };

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
  var hash = otpHash_(otp);
  var userRole = idx.role !== -1 ? data[rowIndex][idx.role] : "User";

  if (idx.otp === -1) {
    idx.otp = data[0].length;
    usersSheet.getRange(1, idx.otp + 1).setValue("OTP");
  }
  if (idx.expiry === -1) {
    idx.expiry = data[0].length;
    usersSheet.getRange(1, idx.expiry + 1).setValue("Expiry");
  }
  if (idx.attempts === -1) {
    idx.attempts = data[0].length;
    usersSheet.getRange(1, idx.attempts + 1).setValue("Attempts");
  }

  usersSheet.getRange(rowIndex + 1, idx.otp + 1).setValue(otp);
  usersSheet.getRange(rowIndex + 1, idx.expiry + 1).setValue(String(expiry));
  usersSheet.getRange(rowIndex + 1, idx.attempts + 1).setValue(0);

  try {
    GmailApp.sendEmail(
      email,
      "AssestFlow - Login Verification Code",
      "Your AssestFlow login code is " +
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
        subject: "AssestFlow - Login Verification Code",
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
  if (idx.email === -1 || idx.otp === -1) {
    return { error: "Users sheet not configured. Run setupSheets()." };
  }

  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][idx.email]) === email) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) return { error: "Email not authorized" };

  var row = data[rowIndex];
  var saved = String(row[idx.otp] || "").trim();
  var expiry = idx.expiry !== -1 ? parseInt(row[idx.expiry], 10) || 0 : 0;
  var attempts = idx.attempts !== -1 ? parseInt(row[idx.attempts], 10) || 0 : 0;

  if (!saved) return { error: "OTP not requested. Please request a new code." };
  if (expiry && new Date().getTime() > expiry) {
    return { error: "OTP has expired. Please request a new one." };
  }
  if (attempts >= MAX_OTP_ATTEMPTS) {
    return { error: "Too many failed attempts. Request a new OTP." };
  }

  var incomingHash = otpHash_(otp);
  var valid = saved === incomingHash || saved === otp;

  if (!valid) {
    if (idx.attempts !== -1) {
      usersSheet.getRange(rowIndex + 1, idx.attempts + 1).setValue(attempts + 1);
    }
    return { error: "Invalid OTP. Please try again." };
  }

  usersSheet.getRange(rowIndex + 1, idx.otp + 1).setValue("");
  if (idx.expiry !== -1) usersSheet.getRange(rowIndex + 1, idx.expiry + 1).setValue("");
  if (idx.attempts !== -1) usersSheet.getRange(rowIndex + 1, idx.attempts + 1).setValue(0);

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
  var sheet = null;
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === USERS_SHEET_GID) {
      sheet = sheets[i];
      break;
    }
  }
  if (!sheet) sheet = ss.getSheetByName("Users");
  if (sheet) {
    var userHeaders = ["Email", "Role", "Locations", "Plants", "Categories", "OTP", "Expiry", "Attempts"];
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
      sheet.deleteRow(r + 1);
      return { success: true };
    }
  }
  return { error: "User not found" };
}

// ============================================================
// Files & Redirection
// ============================================================

function handleFileUpload_(payload) {
  var folderIter = DriveApp.getFoldersByName("AssestFlow_Documents");
  var folder = folderIter.hasNext()
    ? folderIter.next()
    : DriveApp.createFolder("AssestFlow_Documents");
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
    sh.getRange(start, 1, start + rows.length - 1, 4).setValues(rows);
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
  return types;
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
    sh.getRange(2, 1, 1 + rows.length, 2).setValues(rows);
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
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var item = {};
    for (var h = 0; h < headers.length; h++) {
      item[headers[h]] = row[h];
    }
    list.push({
      employeeId: String(item["Employee ID"] || "").trim().toUpperCase(),
      name: String(item["Name"] || "").trim(),
      email: String(item["Email"] || "").trim().toLowerCase(),
      phone: String(item["Phone"] || "").trim(),
      department: String(item["Department"] || "").trim(),
      location: String(item["Location"] || "").trim(),
      designation: String(item["Designation"] || "").trim(),
      plant: String(item["Plant Code"] || item["Plant / Location"] || item["Plant"] || "").trim(),
      status: String(item["Status"] || "Active").trim() === "Inactive" ? "Inactive" : "Active",
      createdAt: String(item["Created Date"] || ""),
      updatedAt: String(item["Updated Date"] || "")
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
  for (var i = 1; i < data.length; i++) {
    if (normalizeId_(data[i][0]) === idStr) return i + 1;
  }
  return -1;
}

function addEmployee_(emp) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureMetaSheets_(ss);
  var sh = ss.getSheetByName("Employees");
  var id = String(emp.employeeId || "").trim().toUpperCase();
  if (!id) return { error: "Employee ID required" };
  if (findEmployeeRow_(id) !== -1) return { error: "Employee ID already exists" };
  var now = new Date().toISOString();
  sh.appendRow([
    id,
    String(emp.name || "").trim(),
    String(emp.email || "").trim().toLowerCase(),
    String(emp.phone || "").trim(),
    String(emp.department || "").trim(),
    String(emp.location || "").trim(),
    String(emp.designation || "").trim(),
    String(emp.plant || "").trim(),
    emp.status === "Inactive" ? "Inactive" : "Active",
    now,
    now
  ]);
  return { success: true, employee: emp };
}

function updateEmployee_(emp) {
  var row = findEmployeeRow_(emp.employeeId);
  if (row === -1) return addEmployee_(emp);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Employees");
  var now = new Date().toISOString();
  sh.getRange(row, 1, 1, 11).setValues([[
    String(emp.employeeId || "").trim().toUpperCase(),
    String(emp.name || "").trim(),
    String(emp.email || "").trim().toLowerCase(),
    String(emp.phone || "").trim(),
    String(emp.department || "").trim(),
    String(emp.location || "").trim(),
    String(emp.designation || "").trim(),
    String(emp.plant || "").trim(),
    emp.status === "Inactive" ? "Inactive" : "Active",
    sh.getRange(row, 10).getValue() || now,
    now
  ]]);
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

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getSheetByNameCaseInsensitive_(ss, name) {
  var sheets = ss.getSheets();
  var nameLower = name.toLowerCase().trim();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getName().toLowerCase().trim() === nameLower) {
      return sheets[i];
    }
  }
  return null;
}

function normalizeId_(id) {
  return String(id || "").replace(/^0+/, "").trim();
}

function indexOfNormalized_(headers, target) {
  var t = String(target || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (h === t) return i;
  }
  return -1;
}

// --- Inventory ---

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
  var id = String(item.itemId || "").trim().toUpperCase();
  var assetCode = String(item.assetCode || "").trim().toUpperCase();
  if (!id) return { error: "Item ID required" };
  if (findInventoryRow_(id, assetCode) !== -1) return { error: "Item ID or Asset Code already exists" };
  var now = new Date().toISOString();
  sh.appendRow([
    id,
    assetCode,
    String(item.itemName || "").trim(),
    String(item.brandName || "").trim(),
    String(item.model || "").trim(),
    String(item.serialNumber || "").trim().toUpperCase(),
    String(item.category || "IT Assets").trim(),
    String(item.status || "Available").trim(),
    Number(item.quantity) || 0,
    Number(item.minStock) || 0,
    now
  ]);
  return { success: true, item: item };
}

function updateInventoryItem_(item) {
  var row = findInventoryRow_(item.itemId);
  if (row === -1) return addInventoryItem_(item);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName("Inventory");
  var now = new Date().toISOString();
  sh.getRange(row, 1, 1, 11).setValues([[
    String(item.itemId || "").trim().toUpperCase(),
    String(item.assetCode || "").trim().toUpperCase(),
    String(item.itemName || "").trim(),
    String(item.brandName || "").trim(),
    String(item.model || "").trim(),
    String(item.serialNumber || "").trim().toUpperCase(),
    String(item.category || "IT Assets").trim(),
    String(item.status || "Available").trim(),
    Number(item.quantity) || 0,
    Number(item.minStock) || 0,
    now
  ]]);
  return { success: true, item: item };
}

function deleteInventoryItem_(item) {
  var row = findInventoryRow_(item.itemId);
  if (row === -1) return { error: "Item not found" };
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.getSheetByName("Inventory").deleteRow(row);
  return { success: true };
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
  var keyColIndex = headers.indexOf(keyName);
  if (keyColIndex === -1) return -1;
  var targetVal = String(keyValue || "").trim().toLowerCase();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyColIndex] || "").trim().toLowerCase() === targetVal) {
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
    migrateCombinedLocationsSheet_(locSh, ss);
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

/** Old combined Locations tab (Location + Plant in one row) → separate Locations & Plants tabs */
function migrateCombinedLocationsSheet_(locSh, ss) {
  var data = locSh.getDataRange().getValues();
  if (data.length < 2) return;
  var headers = data[0];
  var plantCodeIdx = headers.indexOf("Plant Code");
  if (plantCodeIdx === -1) return;

  var plantSh = ss.getSheetByName("Plants");
  if (!plantSh) {
    plantSh = ss.insertSheet("Plants");
    plantSh.getRange(1, 1, 1, 4).setValues([["Plant Code", "Plant Name", "Location Name", "Created Date"]]);
    plantSh.setFrozenRows(1);
  }

  var nowStr = new Date().toISOString();
  var plantNameIdx = headers.indexOf("Plant Name");
  var deptIdx = headers.indexOf("Department Name");
  if (deptIdx === -1) deptIdx = headers.indexOf("Department");

  var locRows = [["Location Name", "Department", "Created Date"]];
  var plantRows = [["Plant Code", "Plant Name", "Location Name", "Created Date"]];
  var seenLoc = {};

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var locName = String(row[0] || "").trim();
    var plantCode = String(row[plantCodeIdx] || "").trim();
    var plantName = plantNameIdx !== -1 ? String(row[plantNameIdx] || "").trim() : "";
    var dept = deptIdx !== -1 ? String(row[deptIdx] || "").trim() : "";

    if (locName && !seenLoc[locName]) {
      seenLoc[locName] = true;
      locRows.push([locName, dept, nowStr]);
    }
    if (plantCode) {
      plantRows.push([plantCode, plantName || plantCode, locName, nowStr]);
    }
  }

  if (locRows.length > 1) {
    locSh.clear();
    locSh.getRange(1, 1, locRows.length, 3).setValues(locRows);
    locSh.setFrozenRows(1);
  }
  if (plantRows.length > 1) {
    plantSh.clear();
    plantSh.getRange(1, 1, plantRows.length, 4).setValues(plantRows);
    plantSh.setFrozenRows(1);
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

  return {
    success: true,
    message: "Locations and Plants sheets updated",
    locations: listLocationsFromSheet_(),
    plants: listPlantsFromSheet_()
  };
}

function setupRedesignedSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var sheetsConfig = {
    "Users": ["Email", "Role", "Locations", "Plants", "Categories", "OTP", "Expiry", "Attempts"],
    "Categories": ["Category Name", "Description", "Created Date"],
    "Asset_Types": ["Type ID", "Type Name", "Main Category", "Config JSON"],
    "Inventory": ["Item ID", "Asset Code", "Item Name", "Brand Name", "Model", "Serial Number", "Category", "Status", "Quantity", "Min Stock", "Updated Date"],
    "Assets": [
      "Asset ID", "Category", "Sub Category", "Asset Type", "Asset Name", "Brand", "Model",
      "Serial Number", "Vehicle Number", "Asset Code", "MAC Address",
      "Location", "Plant Code", "Plant Name", "Department",
      "Assigned To", "Employee ID", "Contact Email", "Contact Number",
      "Purchase Date", "Warranty Date", "Condition", "Status",
      "Photo URL", "Document URL", "Remarks", "Unique Code", "Binary Code",
      "Created By", "Created Date", "Updated By", "Updated Date",
      "Extra Items", "Missing Items", "Assigned Date", "Return Date"
    ],
    "Asset_Extra_Items": ["Record ID", "Parent Asset ID", "Item Name", "Quantity", "Serial Number", "Condition", "Status", "Remarks", "Updated Date"],
    "Assignments": ["Assignment ID", "Asset/Inventory ID", "Type", "Assignee Name", "Assignee ID", "Department", "Contact Number", "Assigned Date", "Assigned By", "Status", "Remarks"],
    "Assignment_History": ["Record ID", "Asset ID", "Action", "Employee ID", "Employee Name", "Contact Number", "Assigned Date", "Returned Date", "Assigned By", "Remarks", "From Employee ID", "From Employee Name"],
    "Missing_Items": ["Record ID", "Parent Asset ID", "Parent Asset Name", "Missing Item Name", "Assigned Person", "Missing Date", "Status", "Remarks", "Recovered Date", "Recovered By"],
    "Damaged_Items": ["Record ID", "Asset ID", "Asset Name", "Damage Date", "Damage Reason", "Reported By", "Repair Required", "Estimated Cost", "Status", "Remarks"],
    "Repair_Records": ["Record ID", "Asset ID", "Repair Vendor", "Sent Date", "Return Date", "Cost", "Status", "Remarks"],
    "Locations": ["Location Name", "Department", "Created Date"],
    "Plants": ["Plant Code", "Plant Name", "Location Name", "Created Date"],
    "Audit_Logs": ["Log ID", "User Email", "Action", "Target ID", "Date & Time", "Old Value", "New Value", "Remarks"]
  };

  for (var name in sheetsConfig) {
    var headers = sheetsConfig[name];
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.setFrozenRows(1);
    } else {
      ensureSheetHeaders_(sh, headers);
    }
    var lastCol = sh.getLastColumn();
    if (lastCol > 0) {
      var hr = sh.getRange(1, 1, 1, lastCol);
      hr.setBackground("#0f766e");
      hr.setFontColor("#ffffff");
      hr.setFontWeight("bold");
    }
  }

  var catSh = ss.getSheetByName("Categories");
  if (catSh && catSh.getLastRow() === 1) {
    var nowStr = new Date().toISOString();
    catSh.appendRow(["IT Assets", "Laptops, Desktops, Keyboards, Mice, Monitors, and other computing accessories.", nowStr]);
    catSh.appendRow(["Office Assets", "Office furniture, ACs, water dispensers, refrigerators, etc.", nowStr]);
    catSh.appendRow(["Vehicle Assets", "Company cars, bikes, forklifts, battery vehicles.", nowStr]);
    catSh.appendRow(["Furniture Assets", "Workstations, meeting tables, racks, chairs.", nowStr]);
    catSh.appendRow(["Production Assets", "Manufacturing machines, tools, fixtures, die, moulds.", nowStr]);
  }

  var typeSh = ss.getSheetByName("Asset_Types");
  if (typeSh && typeSh.getLastRow() === 1) {
    var defaultTypes = [
      ["laptop", "Laptop", "IT Assets", JSON.stringify([
        { key: "processor", label: "Processor", type: "text", required: true },
        { key: "ram", label: "RAM", type: "select", required: true, options: ["4GB", "8GB", "16GB", "32GB", "64GB"] },
        { key: "rom", label: "ROM / Storage", type: "select", required: true, options: ["128GB", "256GB", "512GB", "1TB", "2TB"] },
        { key: "windows_version", label: "Windows Version", type: "select", options: ["Windows 10 Pro", "Windows 11 Pro", "Windows 11 Home", "macOS", "Linux"] },
        { key: "charger_available", label: "Charger Available", type: "select", options: ["Yes", "No"] }
      ])],
      ["desktop", "Desktop", "IT Assets", JSON.stringify([
        { key: "processor", label: "Processor", type: "text", required: true },
        { key: "ram", label: "RAM", type: "select", required: true, options: ["4GB", "8GB", "16GB", "32GB"] },
        { key: "rom", label: "Storage", type: "select", required: true, options: ["256GB", "512GB", "1TB", "2TB"] },
        { key: "windows_version", label: "Windows Version", type: "select", options: ["Windows 10 Pro", "Windows 11 Pro"] }
      ])],
      ["vehicle", "Car / Vehicle", "Vehicle Assets", JSON.stringify([
        { key: "vehicle_number", label: "Vehicle Number", type: "text", required: true },
        { key: "vehicle_type", label: "Vehicle Type", type: "select", options: ["Car", "Bike", "Truck", "Forklift", "E-Rickshaw"] },
        { key: "rc_number", label: "RC Number", type: "text" },
        { key: "insurance_expiry", label: "Insurance Expiry", type: "date", required: true },
        { key: "pollution_expiry", label: "Pollution Expiry", type: "date" },
        { key: "driver_assigned", label: "Driver Assigned", type: "text" },
        { key: "fuel_type", label: "Fuel Type", type: "select", options: ["Petrol", "Diesel", "CNG", "Electric", "Hybrid"] }
      ])],
      ["fan", "Fan", "Office Assets", JSON.stringify([
        { key: "fan_type", label: "Fan Type", type: "select", options: ["Ceiling", "Table", "Wall", "Exhaust", "Industrial"] },
        { key: "fan_size", label: "Size", type: "text" },
        { key: "installation_date", label: "Installation Date", type: "date" }
      ])]
    ];
    for (var i = 0; i < defaultTypes.length; i++) {
      typeSh.appendRow(defaultTypes[i]);
    }
  }

  ensureLocationsPlantsSheets_(ss);
  seedDefaultLocationsPlants_();

  seedDefaultAdminUser_();
}

function clearSheetDataRows_(sh) {
  if (!sh) return;
  var last = sh.getLastRow();
  if (last > 1) sh.deleteRows(2, last - 1);
}

function seedDefaultRedesignedData_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nowStr = new Date().toISOString();

  var catSh = ss.getSheetByName("Categories");
  if (catSh) {
    catSh.appendRow(["IT Assets", "Laptops, Desktops, Keyboards, Mice, Monitors, and other computing accessories.", nowStr]);
    catSh.appendRow(["Office Assets", "Office furniture, ACs, water dispensers, refrigerators, etc.", nowStr]);
    catSh.appendRow(["Vehicle Assets", "Company cars, bikes, forklifts, battery vehicles.", nowStr]);
    catSh.appendRow(["Furniture Assets", "Workstations, meeting tables, racks, chairs.", nowStr]);
    catSh.appendRow(["Production Assets", "Manufacturing machines, tools, fixtures, die, moulds.", nowStr]);
  }

  var typeSh = ss.getSheetByName("Asset_Types");
  if (typeSh) {
    var defaultTypes = [
      ["laptop", "Laptop", "IT Assets", JSON.stringify([
        { key: "processor", label: "Processor", type: "text", required: true },
        { key: "ram", label: "RAM", type: "select", required: true, options: ["4GB", "8GB", "16GB", "32GB", "64GB"] },
        { key: "rom", label: "ROM / Storage", type: "select", required: true, options: ["128GB", "256GB", "512GB", "1TB", "2TB"] }
      ])],
      ["vehicle", "Car / Vehicle", "Vehicle Assets", JSON.stringify([
        { key: "vehicle_number", label: "Vehicle Number", type: "text", required: true },
        { key: "fuel_type", label: "Fuel Type", type: "select", options: ["Petrol", "Diesel", "CNG", "Electric"] }
      ])]
    ];
    for (var i = 0; i < defaultTypes.length; i++) {
      typeSh.appendRow(defaultTypes[i]);
    }
  }

  ensureLocationsPlantsSheets_(ss);
  seedDefaultLocationsPlants_();

  seedDefaultAdminUser_();
}

function seedDefaultLocationsPlants_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var nowStr = new Date().toISOString();
  var locSh = ss.getSheetByName("Locations");
  var plantSh = ss.getSheetByName("Plants");
  if (locSh && locSh.getLastRow() === 1) {
    locSh.appendRow(["Head Office", "IT", nowStr]);
    locSh.appendRow(["Bhiwadi Plant", "Manufacturing", nowStr]);
  }
  if (plantSh && plantSh.getLastRow() === 1) {
    plantSh.appendRow(["HO-01", "Corporate HQ", "Head Office", nowStr]);
    plantSh.appendRow(["BHW-01", "Production Plant 1", "Bhiwadi Plant", nowStr]);
  }
}

function seedDefaultAdminUser_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var usersSh = ss.getSheetByName("Users");
  if (!usersSh) return;
  var userHeaders = ["Email", "Role", "Locations", "Plants", "Categories", "OTP", "Expiry", "Attempts"];
  ensureSheetHeaders_(usersSh, userHeaders);
  var data = usersSh.getDataRange().getValues();
  var idx = findUserRowIndexes_(data[0]);
  if (idx.email === -1) return;
  for (var r = 1; r < data.length; r++) {
    if (normalizeEmail_(data[r][idx.email]) === "admin@example.com") return;
  }
  var adminRow = new Array(data[0].length).fill("");
  adminRow[idx.email] = "admin@example.com";
  if (idx.role !== -1) adminRow[idx.role] = "IT Admin";
  if (idx.loc !== -1) adminRow[idx.loc] = "All";
  if (idx.plant !== -1) adminRow[idx.plant] = "All";
  if (idx.categories !== -1) adminRow[idx.categories] = "All";
  if (idx.attempts !== -1) adminRow[idx.attempts] = 0;
  usersSh.appendRow(adminRow);
}

function setupRedesignedSheetsFresh() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  setupRedesignedSheets();

  var clearSheets = [
    "Assets", "Asset_Extra_Items", "Assignments", "Assignment_History",
    "Missing_Items", "Damaged_Items", "Repair_Records", "Inventory",
    "Categories", "Asset_Types", "Audit_Logs"
  ];
  for (var i = 0; i < clearSheets.length; i++) {
    clearSheetDataRows_(ss.getSheetByName(clearSheets[i]));
  }

  clearSheetDataRows_(ss.getSheetByName("Locations"));
  clearSheetDataRows_(ss.getSheetByName("Plants"));

  var usersSh = ss.getSheetByName("Users");
  clearSheetDataRows_(usersSh);

  migrateCategorySheetNames_(ss);
  for (var c = 0; c < CATEGORIES.length; c++) {
    clearSheetDataRows_(ss.getSheetByName(CATEGORIES[c]));
  }

  seedDefaultRedesignedData_();
}

function normIdent_(v) {
  return String(v || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function checkAssetIdentifierDuplicates_(rowData, excludeAssetId) {
  var list = listRedesignedTable_("Assets");
  var serial = normIdent_(rowData["Serial Number"]);
  var code = normIdent_(rowData["Asset Code"]);
  var veh = normIdent_(rowData["Vehicle Number"]);
  var unique = normIdent_(rowData["Unique Code"]);
  var exclude = excludeAssetId ? normIdent_(excludeAssetId) : "";

  for (var i = 0; i < list.length; i++) {
    var row = list[i];
    var aid = normIdent_(row["Asset ID"]);
    if (exclude && aid === exclude) continue;

    var rSerial = normIdent_(row["Serial Number"]);
    var rCode = normIdent_(row["Asset Code"]);
    var rVeh = normIdent_(row["Vehicle Number"]);
    var rUnique = normIdent_(row["Unique Code"]);

    if (serial) {
      if (rSerial && rSerial === serial) return { error: "Duplicate serial number — already registered to Asset " + row["Asset ID"] };
      if (rVeh && rVeh === serial) return { error: "Serial number matches an existing vehicle number on Asset " + row["Asset ID"] };
    }
    if (veh) {
      if (rVeh && rVeh === veh) return { error: "Duplicate vehicle number — already registered to Asset " + row["Asset ID"] };
      if (rSerial && rSerial === veh) return { error: "Vehicle number matches an existing serial on Asset " + row["Asset ID"] };
    }
    if (code && rCode && rCode === code) return { error: "Duplicate asset code — already registered to Asset " + row["Asset ID"] };
    if (unique && rUnique && rUnique === unique) return { error: "Duplicate unique code — already registered to Asset " + row["Asset ID"] };
  }
  return null;
}

function sanitizeSheetName_(name) {
  if (!name) return "";
  var clean = String(name)
    .replace(/[\\\/\?\*\:\[\]]/g, "")
    .replace(/^['"]|['"]$/g, "")
    .trim();
  if (clean.length > 30) {
    clean = clean.substring(0, 30);
  }
  return clean;
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

  var assetsSh = ss.getSheetByName("Assets");
  if (assetsSh && assetsSh.getLastRow() > 1) {
    var data = assetsSh.getDataRange().getValues();
    var headers = data[0];
    var locIdx = headers.indexOf("Location");
    if (locIdx !== -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][locIdx] || "").trim() === oldName) {
          assetsSh.getRange(i + 1, locIdx + 1).setValue(newName);
        }
      }
    }
  }

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

  var assetsSh = ss.getSheetByName("Assets");
  if (assetsSh && assetsSh.getLastRow() > 1) {
    var data = assetsSh.getDataRange().getValues();
    var headers = data[0];
    var locIdx = headers.indexOf("Location");
    if (locIdx !== -1) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][locIdx] || "").trim() === name) {
          assetsSh.getRange(i + 1, locIdx + 1).setValue("");
        }
      }
    }
  }

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

  var assetsSh = ss.getSheetByName("Assets");
  if (assetsSh && assetsSh.getLastRow() > 1) {
    var data = assetsSh.getDataRange().getValues();
    var headers = data[0];
    var codeIdx = headers.indexOf("Plant Code");
    var nameIdx = headers.indexOf("Plant Name");
    var locIdx = headers.indexOf("Location");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][codeIdx] || "").trim() === oldCode) {
        if (codeIdx !== -1) assetsSh.getRange(i + 1, codeIdx + 1).setValue(newCode);
        if (nameIdx !== -1) assetsSh.getRange(i + 1, nameIdx + 1).setValue(newName);
        if (locIdx !== -1 && location) assetsSh.getRange(i + 1, locIdx + 1).setValue(location);
      }
    }
  }

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
        if (existingArchive) {
          ss.deleteSheet(existingArchive);
        }
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
        if (String(data[i][codeIdx] || "").trim() === code) {
          plantSh.deleteRow(i + 1);
        }
      }
    }
  }

  var assetsSh = ss.getSheetByName("Assets");
  if (assetsSh && assetsSh.getLastRow() > 1) {
    var data = assetsSh.getDataRange().getValues();
    var headers = data[0];
    var codeIdx = headers.indexOf("Plant Code");
    var nameIdx = headers.indexOf("Plant Name");
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][codeIdx] || "").trim() === code) {
        if (codeIdx !== -1) assetsSh.getRange(i + 1, codeIdx + 1).setValue("");
        if (nameIdx !== -1) assetsSh.getRange(i + 1, nameIdx + 1).setValue("");
      }
    }
  }

  syncLocationAndPlantAssetSheets_(ss);
  return { success: true };
}

function syncLocationAndPlantAssetSheets_(ss) {
  if (!ss) ss = SpreadsheetApp.getActiveSpreadsheet();

  var locs = [];
  var locSh = ss.getSheetByName("Locations");
  if (locSh && locSh.getLastRow() > 1) {
    var locData = locSh.getDataRange().getValues();
    var locHeaders = locData[0];
    var nameIdx = locHeaders.indexOf("Location Name");
    if (nameIdx !== -1) {
      for (var i = 1; i < locData.length; i++) {
        var name = String(locData[i][nameIdx] || "").trim();
        if (name) locs.push(name);
      }
    }
  }

  var plants = [];
  var plantSh = ss.getSheetByName("Plants");
  if (plantSh && plantSh.getLastRow() > 1) {
    var plantData = plantSh.getDataRange().getValues();
    var plantHeaders = plantData[0];
    var codeIdx = plantHeaders.indexOf("Plant Code");
    if (codeIdx !== -1) {
      for (var i = 1; i < plantData.length; i++) {
        var code = String(plantData[i][codeIdx] || "").trim();
        if (code) plants.push(code);
      }
    }
  }

  var assetsSh = ss.getSheetByName("Assets");
  if (!assetsSh) return;
  var assetsData = assetsSh.getDataRange().getValues();
  if (assetsData.length < 1) return;
  var assetsHeaders = assetsData[0];
  var assetsRows = assetsData.slice(1);

  var assetLocIdx = assetsHeaders.indexOf("Location");
  var assetPlantIdx = assetsHeaders.indexOf("Plant Code");

  var syncTab = function(tabName, filterFn) {
    var sanitizedName = sanitizeSheetName_(tabName);
    if (!sanitizedName) return;
    var sh = ss.getSheetByName(sanitizedName);
    if (!sh) {
      sh = ss.insertSheet(sanitizedName);
      sh.getRange(1, 1, 1, assetsHeaders.length).setValues([assetsHeaders]);
      sh.setFrozenRows(1);
      var hr = sh.getRange(1, 1, 1, assetsHeaders.length);
      hr.setBackground("#0284c7");
      hr.setFontColor("#ffffff");
      hr.setFontWeight("bold");
    } else {
      if (sh.getLastRow() > 1) {
        sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
      }
    }

    var matchingRows = [];
    for (var r = 0; r < assetsRows.length; r++) {
      if (filterFn(assetsRows[r])) {
        matchingRows.push(assetsRows[r]);
      }
    }

    if (matchingRows.length > 0) {
      sh.getRange(2, 1, matchingRows.length, assetsHeaders.length).setValues(matchingRows);
    }
  };

  for (var l = 0; l < locs.length; l++) {
    var locName = locs[l];
    (function(name) {
      syncTab(name, function(row) {
        return assetLocIdx !== -1 && String(row[assetLocIdx] || "").trim() === name;
      });
    })(locName);
  }

  for (var p = 0; p < plants.length; p++) {
    var plantCode = plants[p];
    (function(code) {
      syncTab(code, function(row) {
        return assetPlantIdx !== -1 && String(row[assetPlantIdx] || "").trim() === code;
      });
    })(plantCode);
  }
}
