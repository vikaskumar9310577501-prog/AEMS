/**
 * MERGE into your existing Apps Script (do NOT replace whole file).
 * Add these functions + cases inside your current doPost(e).
 */

var USERS_SHEET_GID = 1792788791;

function getUsersSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() === USERS_SHEET_GID) return sheets[i];
  }
  return ss.getSheetByName("Users");
}

function ensureUserHeaders_(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length === 0 || !data[0][0]) {
    sheet.getRange(1, 1, 1, 4).setValues([["Email", "Role", "Locations", "Plants"]]);
  }
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
    var email = String(data[r][idx.email] || "").trim();
    if (!email) continue;
    users.push({
      email: email,
      role: idx.role !== -1 ? data[r][idx.role] : "User",
      locations: idx.loc !== -1 ? data[r][idx.loc] : "",
      plants: idx.plant !== -1 ? data[r][idx.plant] : "",
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
  };
}

function formatList_(v) {
  if (Object.prototype.toString.call(v) === "[object Array]") return v.join(", ");
  return String(v || "");
}

function addUserToSheet_(body) {
  var user = normalizeUserInput_(body);
  if (!user.email) return { error: "Email is required" };
  var sheet = getUsersSheet_();
  if (!sheet) return { error: "Users sheet not found" };
  ensureUserHeaders_(sheet);
  var data = sheet.getDataRange().getValues();
  var idx = findUserColIndexes_(data[0]);
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx.email] || "").trim().toLowerCase() === user.email) {
      return { error: "User already exists" };
    }
  }
  sheet.appendRow([
    user.email,
    user.role,
    formatList_(user.locations),
    formatList_(user.plants),
  ]);
  return { success: true, user: user };
}

function updateUserInSheet_(body) {
  var user = normalizeUserInput_(body);
  if (!user.email) return { error: "Email is required" };
  var sheet = getUsersSheet_();
  if (!sheet) return { error: "Users sheet not found" };
  var data = sheet.getDataRange().getValues();
  var idx = findUserColIndexes_(data[0]);
  var rowNum = -1;
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idx.email] || "").trim().toLowerCase() === user.email) {
      rowNum = r + 1;
      break;
    }
  }
  if (rowNum === -1) return { error: "User not found" };
  if (idx.role !== -1) sheet.getRange(rowNum, idx.role + 1).setValue(user.role);
  if (idx.loc !== -1) sheet.getRange(rowNum, idx.loc + 1).setValue(formatList_(user.locations));
  if (idx.plant !== -1) sheet.getRange(rowNum, idx.plant + 1).setValue(formatList_(user.plants));
  return { success: true, user: user };
}

function deleteUserFromSheet_(body) {
  var email = String(body.email || (body.user && body.user.email) || "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Email is required" };
  var sheet = getUsersSheet_();
  if (!sheet) return { error: "Users sheet not found" };
  var data = sheet.getDataRange().getValues();
  var idx = findUserColIndexes_(data[0]);
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][idx.email] || "").trim().toLowerCase() === email) {
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

/*
  Inside doPost(e), after var body = JSON.parse(e.postData.contents);

  if (body.action === "list_users" || body.action === "get_users") {
    return ContentService.createTextOutput(JSON.stringify(listUsersFromSheet_()))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (body.action === "add_user") {
    return ContentService.createTextOutput(JSON.stringify(addUserToSheet_(body)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (body.action === "update_user") {
    return ContentService.createTextOutput(JSON.stringify(updateUserInSheet_(body)))
      .setMimeType(ContentService.MimeType.JSON);
  }
  if (body.action === "delete_user") {
    return ContentService.createTextOutput(JSON.stringify(deleteUserFromSheet_(body)))
      .setMimeType(ContentService.MimeType.JSON);
  }
*/
