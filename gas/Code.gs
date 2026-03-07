/**
 * 학급 경영 올인원 - Google Apps Script 백엔드
 * doPost/doGet에서 action 파라미터로 분기하여 REST API 역할 수행
 * 시트: Forms, Responses, Folders, Students, SmsLogs
 */

var SPREADSHEET_ID = null; // 배포 시 스프레드시트 ID로 설정하거나 Script Property 사용

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ----- 시트 이름 상수 -----
var SHEETS = {
  FORMS: 'Forms',
  RESPONSES: 'Responses',
  FOLDERS: 'Folders',
  STUDENTS: 'Students',
  SMS_LOGS: 'SmsLogs',
  CLASS: 'Class',
  RECORD: 'record',
  RECORD_SUMMARY: 'RecordSummary'
};

// 생기부 record 시트 헤더 (순서 유지)
var RECORD_HEADERS = ['학번', '이름', '희망진로', '학년', '영역', '기록내용 요약', '개별/단체', '학업역량', '진로역량', '공동체역량', '세부역량', '연속적 활동(셀주소 입력)', '읽은 책', '평가'];

/**
 * 스프레드시트를 열 때 메뉴에 "생기부" 항목 추가
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.createMenu('생기부')
        .addItem('record / RecordSummary 시트 생성', 'createRecordSheets')
        .addToUi();
    }
  } catch (e) {
    // 스크립트 편집기 등에서는 getUi()가 없을 수 있음
  }
}

/**
 * doGet: GET 요청 처리 (CORS 헤더 포함)
 */
function doGet(e) {
  return handleRequest(e, 'GET');
}

/**
 * doPost: POST 요청 처리
 */
function doPost(e) {
  return handleRequest(e, 'POST');
}

function handleRequest(e, method) {
  var result = { success: false, error: 'Unknown action' };
  try {
    var params = method === 'GET' ? (e && e.parameter) || {} : {};
    if (method === 'POST' && e && e.postData && e.postData.contents) {
      try {
        var body = JSON.parse(e.postData.contents);
        params = body || {};
      } catch (err) {
        result.error = 'Invalid JSON body';
        return jsonResponse(result);
      }
    }
    var action = (params.action || (e && e.parameter && e.parameter.action) || '').toString().trim();
    if (!action) {
      result.error = 'Missing action';
      return jsonResponse(result);
    }

    switch (action) {
      case 'GET_FORM':
        result = getForm(params.form_id);
        break;
      case 'GET_FORMS':
        result = getForms(params.folder_id);
        break;
      case 'GET_FOLDERS':
        result = getFolders();
        break;
      case 'GET_RESPONSES':
        result = getResponses(params.form_id);
        break;
      case 'GET_NON_RESPONDERS':
        result = getNonResponders(params.form_id);
        break;
      case 'GET_STUDENTS':
        result = getStudents();
        break;
      case 'SUBMIT_RESPONSE':
        result = submitResponse(params);
        break;
      case 'AUTH_STUDENT':
        result = authStudent(params.student_id, params.auth_code);
        break;
      case 'UPDATE_RESPONSE':
        result = updateResponse(params);
        break;
      case 'DELETE_RESPONSE':
        result = deleteResponse(params.response_id);
        break;
      case 'CREATE_FORM':
        result = createForm(params);
        break;
      case 'UPDATE_FORM':
        result = updateForm(params);
        break;
      case 'DELETE_FORM':
        result = deleteForm(params.form_id);
        break;
      case 'CREATE_FOLDER':
        result = createFolder(params);
        break;
      case 'ADD_STUDENT':
        result = addStudent(params);
        break;
      case 'UPDATE_STUDENT':
        result = updateStudent(params);
        break;
      case 'DELETE_STUDENT':
        result = deleteStudent(params.student_id);
        break;
      case 'GET_CLASS_INFO':
        result = getClassInfo();
        break;
      case 'SAVE_CLASS_INFO':
        result = saveClassInfo(params);
        break;
      case 'SEND_SMS':
        result = sendSms(params);
        break;
      case 'GET_RECORD_BY_STUDENT':
        result = getRecordByStudent(params.student_id, params);
        break;
      case 'GET_RECORD_SUMMARY_EVALUATION':
        result = getRecordSummaryEvaluation(params.student_id);
        break;
      case 'UPDATE_RECORD_SUMMARY_EVALUATION':
        result = updateRecordSummaryEvaluation(params.student_id, params.summary_evaluation);
        break;
      case 'ENSURE_RECORD_SHEET':
        result = ensureRecordSheet();
        break;
      case 'GET_RECORD_UPDATED_IDS':
        result = getRecordUpdatedIds();
        break;
      default:
        result.error = 'Unknown action: ' + action;
    }
  } catch (err) {
    result = { success: false, error: (err && err.message) || String(err) };
  }
  return jsonResponse(result);
}

function jsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ----- 시트 유틸: 행 배열 → 객체 배열 -----
function sheetToObjects(sheet, headers) {
  if (!sheet || !headers || headers.length === 0) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  var out = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j];
    }
    out.push(obj);
  }
  return out;
}

function getSheetHeaders(sheet) {
  var row = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return row.map(String);
}

// ----- 액션 구현 -----

function getForm(formId) {
  if (!formId) return { success: false, error: 'form_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FORMS);
  if (!sheet) return { success: false, error: 'Forms sheet not found' };
  var headers = getSheetHeaders(sheet);
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(formId)) {
      var row = data[i];
      var obj = {};
      for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
      return { success: true, data: obj };
    }
  }
  return { success: false, error: 'Form not found' };
}

function getForms(folderId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FORMS);
  if (!sheet) return { success: false, error: 'Forms sheet not found' };
  var headers = getSheetHeaders(sheet);
  var rows = sheetToObjects(sheet, headers);
  if (folderId) {
    rows = rows.filter(function (r) { return r.folder_id === folderId; });
  }
  rows = rows.filter(function (r) { return r.is_active === true || r.is_active === 'TRUE'; });
  return { success: true, data: rows };
}

function getFolders() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FOLDERS);
  if (!sheet) return { success: false, error: 'Folders sheet not found' };
  var headers = getSheetHeaders(sheet);
  var data = sheetToObjects(sheet, headers);
  return { success: true, data: data };
}

function getResponses(formId) {
  if (!formId) return { success: false, error: 'form_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESPONSES);
  if (!sheet) return { success: false, error: 'Responses sheet not found' };
  var headers = getSheetHeaders(sheet);
  var rows = sheetToObjects(sheet, headers);
  rows = rows.filter(function (r) { return r.form_id === formId; });
  return { success: true, data: rows };
}

function getStudents() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, error: 'Students sheet not found' };
  var headers = getSheetHeaders(sheet);
  // photo_data 헤더가 없고 열이 7개 이상이면 7번째 열을 photo_data로 사용
  if (headers.indexOf('photo_data') < 0 && sheet.getLastColumn() >= 7) {
    sheet.getRange(1, 7).setValue('photo_data');
    headers = getSheetHeaders(sheet);
  }
  var data = sheetToObjects(sheet, headers);
  // 시트에서 숫자로 읽힌 값(학번, 전화번호 등)을 문자열로 통일해 반환
  data = data.map(function (row) {
    var emailVal = row['e-mail'] != null ? row['e-mail'] : (row.email != null ? row.email : '');
    return {
      student_id: String(row.student_id != null ? row.student_id : ''),
      name: String(row.name != null ? row.name : ''),
      auth_code: String(row.auth_code != null ? row.auth_code : ''),
      phone_student: String(row.phone_student != null ? row.phone_student : ''),
      phone_parent: String(row.phone_parent != null ? row.phone_parent : ''),
      email: String(emailVal),
      photo_data: row.photo_data != null ? String(row.photo_data) : ''
    };
  });
  return { success: true, data: data };
}

function getNonResponders(formId) {
  var formRes = getForm(formId);
  if (!formRes.success) return formRes;
  var studentsRes = getStudents();
  if (!studentsRes.success) return studentsRes;
  var responsesRes = getResponses(formId);
  if (!responsesRes.success) return responsesRes;
  var submittedIds = (responsesRes.data || []).map(function (r) { return r.student_id; });
  var students = (studentsRes.data || []).filter(function (s) {
    return submittedIds.indexOf(s.student_id) === -1;
  });
  return { success: true, data: students };
}

function authStudent(studentId, authCode) {
  if (!studentId || !authCode) return { success: false, error: 'student_id and auth_code required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, error: 'Students sheet not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var sidCol = headers.indexOf('student_id');
  var codeCol = headers.indexOf('auth_code');
  var nameCol = headers.indexOf('name');
  if (sidCol < 0 || codeCol < 0) return { success: false, error: 'Column not found' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][sidCol]) === String(studentId) && String(data[i][codeCol]) === String(authCode)) {
      return {
        success: true,
        data: {
          student_id: data[i][sidCol],
          name: nameCol >= 0 ? data[i][nameCol] : ''
        }
      };
    }
  }
  return { success: false, error: 'Invalid credentials' };
}

function generateId() {
  return Utilities.getUuid();
}

function submitResponse(params) {
  var formId = params.form_id, student_id = params.student_id, student_name = params.student_name;
  var answer_data = typeof params.answer_data === 'string' ? params.answer_data : JSON.stringify(params.answer_data || {});
  if (!formId || !student_id) return { success: false, error: 'form_id and student_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESPONSES);
  if (!sheet) return { success: false, error: 'Responses sheet not found' };
  var responseId = generateId();
  var submittedAt = new Date().toISOString();
  sheet.appendRow([responseId, formId, student_id, student_name || '', answer_data, submittedAt]);
  return { success: true, data: { response_id: responseId, submitted_at: submittedAt } };
}

function updateResponse(params) {
  var responseId = params.response_id;
  var answer_data = typeof params.answer_data === 'string' ? params.answer_data : JSON.stringify(params.answer_data || {});
  if (!responseId) return { success: false, error: 'response_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESPONSES);
  if (!sheet) return { success: false, error: 'Responses sheet not found' };
  var data = sheet.getDataRange().getValues();
  var colCount = data[0].length;
  var answerCol = 4; // answer_data 열 인덱스 (0-based: response_id, form_id, student_id, student_name, answer_data, submitted_at)
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(responseId)) {
      sheet.getRange(i + 1, answerCol + 1).setValue(answer_data);
      return { success: true };
    }
  }
  return { success: false, error: 'Response not found' };
}

function deleteResponse(responseId) {
  if (!responseId) return { success: false, error: 'response_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RESPONSES);
  if (!sheet) return { success: false, error: 'Responses sheet not found' };
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(responseId)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: 'Response not found' };
}

function createForm(params) {
  var folder_id = params.folder_id, title = params.title, type = params.type || 'survey';
  var schema = typeof params.schema === 'string' ? params.schema : JSON.stringify(params.schema || { fields: [] });
  if (!title) return { success: false, error: 'title required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FORMS);
  if (!sheet) return { success: false, error: 'Forms sheet not found' };
  var formId = generateId();
  var createdAt = new Date().toISOString();
  sheet.appendRow([formId, folder_id || '', title, type, schema, true, createdAt]);
  return { success: true, data: { form_id: formId, created_at: createdAt } };
}

function createFolder(params) {
  var name = params.name;
  if (!name || String(name).trim() === '') return { success: false, error: 'name required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FOLDERS);
  if (!sheet) return { success: false, error: 'Folders sheet not found' };
  var folderId = generateId();
  sheet.appendRow([folderId, String(name).trim()]);
  return { success: true, data: { folder_id: folderId, name: String(name).trim() } };
}

function updateForm(params) {
  var formId = params.form_id;
  var folder_id = params.folder_id;
  var title = params.title;
  var type = params.type;
  var schema = params.schema;
  if (!formId) return { success: false, error: 'form_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FORMS);
  if (!sheet) return { success: false, error: 'Forms sheet not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var formIdCol = headers.indexOf('form_id');
  var folderIdCol = headers.indexOf('folder_id');
  var titleCol = headers.indexOf('title');
  var typeCol = headers.indexOf('type');
  var schemaCol = headers.indexOf('schema');
  if (formIdCol < 0) return { success: false, error: 'Column not found' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][formIdCol]) === String(formId)) {
      var row = i + 1;
      if (folder_id !== undefined && folderIdCol >= 0) sheet.getRange(row, folderIdCol + 1).setValue(folder_id || '');
      if (title !== undefined && titleCol >= 0) sheet.getRange(row, titleCol + 1).setValue(String(title).trim());
      if (type !== undefined && typeCol >= 0) sheet.getRange(row, typeCol + 1).setValue(type || 'notice');
      if (schema !== undefined && schemaCol >= 0) {
        var schemaStr = typeof schema === 'string' ? schema : JSON.stringify(schema || {});
        sheet.getRange(row, schemaCol + 1).setValue(schemaStr);
      }
      return { success: true };
    }
  }
  return { success: false, error: 'Form not found' };
}

function deleteForm(formId) {
  if (!formId) return { success: false, error: 'form_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.FORMS);
  if (!sheet) return { success: false, error: 'Forms sheet not found' };
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var formIdCol = headers.indexOf('form_id');
  var isActiveCol = headers.indexOf('is_active');
  if (formIdCol < 0) return { success: false, error: 'Column not found' };
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][formIdCol]) === String(formId)) {
      if (isActiveCol >= 0) {
        sheet.getRange(i + 1, isActiveCol + 1).setValue(false);
      } else {
        sheet.deleteRow(i + 1);
      }
      return { success: true };
    }
  }
  return { success: false, error: 'Form not found' };
}

function generateAuthCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var code = '';
  for (var i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function addStudent(params) {
  var student_id = params.student_id, name = params.name;
  if (!student_id || String(student_id).trim() === '') return { success: false, error: 'student_id required' };
  if (!name || String(name).trim() === '') return { success: false, error: 'name required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, error: 'Students sheet not found' };
  var data = sheet.getDataRange().getValues();
  var sidCol = 0;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][sidCol]) === String(student_id).trim()) {
      return { success: false, error: '이미 등록된 학번입니다.' };
    }
  }
  var authCode = generateAuthCode();
  var phone_student = params.phone_student != null ? String(params.phone_student).trim() : '';
  var phone_parent = params.phone_parent != null ? String(params.phone_parent).trim() : '';
  var email = params.email != null ? String(params.email).trim() : '';
  sheet.appendRow([String(student_id).trim(), String(name).trim(), authCode, phone_student, phone_parent, email]);
  return { success: true, data: { student_id: String(student_id).trim(), name: String(name).trim(), auth_code: authCode } };
}

function updateStudent(params) {
  var find_by_student_id = params.find_by_student_id;
  var student_id = params.student_id != null ? String(params.student_id).trim() : '';
  var name = params.name != null ? String(params.name).trim() : '';
  var auth_code = params.auth_code != null ? String(params.auth_code).trim() : '';
  var phone_student = params.phone_student != null ? String(params.phone_student).trim() : '';
  var phone_parent = params.phone_parent != null ? String(params.phone_parent).trim() : '';
  var email = params.email != null ? String(params.email).trim() : '';
  var photo_data = params.photo_data != null ? String(params.photo_data) : '';
  if (!find_by_student_id) return { success: false, error: 'find_by_student_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, error: 'Students sheet not found' };
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(find_by_student_id)) {
      sheet.getRange(i + 1, 1).setValue(student_id || data[i][0]);
      sheet.getRange(i + 1, 2).setValue(name || data[i][1]);
      sheet.getRange(i + 1, 3).setValue(auth_code || data[i][2]);
      sheet.getRange(i + 1, 4).setNumberFormat('@').setValue(phone_student);
      sheet.getRange(i + 1, 5).setNumberFormat('@').setValue(phone_parent);
      sheet.getRange(i + 1, 6).setValue(email);
      if (photo_data) {
        sheet.getRange(i + 1, 7).setValue(photo_data);
      }
      return { success: true };
    }
  }
  return { success: false, error: '학생을 찾을 수 없습니다.' };
}

function deleteStudent(studentId) {
  if (!studentId) return { success: false, error: 'student_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.STUDENTS);
  if (!sheet) return { success: false, error: 'Students sheet not found' };
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (String(data[i][0]) === String(studentId)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { success: false, error: '학생을 찾을 수 없습니다.' };
}

function getOrCreateClassSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.CLASS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.CLASS);
    sheet.getRange(1, 1, 1, 3).setValues([['grade', 'class', 'teacher_name']]);
    sheet.getRange(2, 1, 2, 3).setValues([['', '', '']]);
  }
  return sheet;
}

function getClassInfo() {
  var sheet = getOrCreateClassSheet();
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) {
    return { success: true, data: { grade: '', class: '', teacher_name: '' } };
  }
  var row = data[1];
  return {
    success: true,
    data: {
      grade: String(row[0] != null ? row[0] : ''),
      class: String(row[1] != null ? row[1] : ''),
      teacher_name: String(row[2] != null ? row[2] : '')
    }
  };
}

function saveClassInfo(params) {
  var grade = params.grade != null ? String(params.grade).trim() : '';
  var classNum = params.class != null ? String(params.class).trim() : (params.classNum != null ? String(params.classNum).trim() : '');
  var teacherName = params.teacher_name != null ? String(params.teacher_name).trim() : (params.teacherName != null ? String(params.teacherName).trim() : '');
  var sheet = getOrCreateClassSheet();
  if (sheet.getLastRow() < 2) {
    sheet.appendRow([grade, classNum, teacherName]);
  } else {
    sheet.getRange(2, 1).setValue(grade);
    sheet.getRange(2, 2).setValue(classNum);
    sheet.getRange(2, 3).setValue(teacherName);
  }
  return { success: true, data: { grade: grade, class: classNum, teacher_name: teacherName } };
}

/**
 * SMS 발송 — SOLAPI(솔라피) 연동
 * 실제 발송을 하려면 Script Property에 아래 3가지를 반드시 설정하세요.
 *   SOLAPI_API_KEY    : 솔라피 콘솔에서 발급한 API Key
 *   SOLAPI_API_SECRET : 솔라피 콘솔에서 발급한 API Secret
 *   SOLAPI_SENDER     : 사전 등록된 발신번호 (예: 01012345678)
 * 미설정 시 발송 없이 로그만 기록하며, 에러 메시지로 설정 안내를 반환합니다.
 */
function sendSms(params) {
  var receivers = params.receivers || []; // [{ phone: '010...', name: '홍길동' }]
  var message = params.message || '';
  var template = params.template;
  if (!receivers.length || (!message && !template)) {
    return { success: false, error: 'receivers and (message or template) required' };
  }
  var props = PropertiesService.getScriptProperties();
  var apiKey = props.getProperty('SOLAPI_API_KEY');
  var apiSecret = props.getProperty('SOLAPI_API_SECRET');
  var senderPhone = (props.getProperty('SOLAPI_SENDER') || '').replace(/\D/g, '');
  var logId = generateId();
  var sentAt = new Date().toISOString();
  var ss = getSpreadsheet();
  var logSheet = ss.getSheetByName(SHEETS.SMS_LOGS);

  if (!apiKey || !apiSecret || !senderPhone) {
    if (logSheet) {
      logSheet.appendRow([logId, sentAt, receivers.length, message || template || '', 'config_missing']);
    }
    return {
      success: false,
      error: '문자 발송 설정이 없습니다. GAS 스크립트 속성에 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER(발신번호)를 설정한 뒤 다시 시도해 주세요. (솔라피 콘솔: console.solapi.com)',
    };
  }

  // 수신자별 메시지 — message(또는 template) 안의 {name}, {phone}을 수신자 정보로 치환
  var baseText = (template || message || '').toString();
  var textByReceiver = receivers.map(function (r) {
    var text = baseText
      .replace(/\{name\}/g, (r.name != null ? r.name : '').toString())
      .replace(/\{phone\}/g, (r.phone != null ? r.phone : '').toString());
    return { to: (r.phone || '').replace(/\D/g, ''), text: text };
  });

  var authHeader = buildSolapiAuthHeader(apiKey, apiSecret);
  var payload = {
    messages: textByReceiver.map(function (m) {
      return {
        to: m.to,
        from: senderPhone,
        text: m.text,
      };
    }),
  };

  try {
    var response = UrlFetchApp.fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    var code = response.getResponseCode();
    var body = JSON.parse(response.getContentText() || '{}');

    if (logSheet) {
      var status = code === 200 ? 'sent' : 'api_error';
      logSheet.appendRow([logId, sentAt, receivers.length, message || template || '', status]);
    }

    if (code !== 200) {
      var errMsg = (body.errorMessage || body.message || body.error) || '발송 요청 실패';
      return { success: false, error: 'SOLAPI: ' + errMsg };
    }

    var count = (body.groupInfo && body.groupInfo.count && body.groupInfo.count.sentSuccess) != null
      ? body.groupInfo.count.sentSuccess
      : receivers.length;
    return { success: true, data: { log_id: logId, sent_at: sentAt, receiver_count: count } };
  } catch (e) {
    if (logSheet) {
      logSheet.appendRow([logId, sentAt, receivers.length, message || template || '', 'error']);
    }
    return { success: false, error: '문자 발송 중 오류: ' + (e.message || String(e)) };
  }
}

/**
 * SOLAPI HMAC-SHA256 인증 헤더 생성
 * @see https://developers.solapi.com/references/authentication/api-key
 */
function buildSolapiAuthHeader(apiKey, apiSecret) {
  var dateTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  var salt = Array.apply(null, Array(16))
    .map(function () {
      return ('0' + Math.floor(Math.random() * 256).toString(16)).slice(-2);
    })
    .join('');
  var data = dateTime + salt;
  var signatureBytes = Utilities.computeHmacSha256Signature(data, apiSecret);
  var signature = signatureBytes
    .map(function (b) {
      return ('0' + ((b < 0 ? b + 256 : b) & 0xff).toString(16)).slice(-2);
    })
    .join('');
  return 'HMAC-SHA256 apiKey=' + apiKey + ', date=' + dateTime + ', salt=' + salt + ', signature=' + signature;
}

// ----- 생기부 record 시트 -----
/**
 * 스크립트 편집기 또는 스프레드시트 메뉴에서 실행하여
 * 'record' 시트와 'RecordSummary' 시트를 수동으로 생성합니다.
 * (웹앱에서 생기부 분석 대시보드를 열어도 자동 생성됩니다.)
 */
function createRecordSheets() {
  var ss = getSpreadsheet();
  var created = [];
  var sheet = ss.getSheetByName(SHEETS.RECORD);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.RECORD);
    sheet.getRange(1, 1, 1, RECORD_HEADERS.length).setValues([RECORD_HEADERS]);
    created.push(SHEETS.RECORD);
  }
  sheet = ss.getSheetByName(SHEETS.RECORD_SUMMARY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.RECORD_SUMMARY);
    sheet.getRange(1, 1, 1, 2).setValues([['student_id', 'summary_evaluation']]);
    created.push(SHEETS.RECORD_SUMMARY);
  }
  if (created.length > 0) {
    Logger.log('생성된 시트: ' + created.join(', '));
    if (typeof SpreadsheetApp.getUi !== 'undefined') {
      try {
        SpreadsheetApp.getUi().alert('생기부 시트 생성 완료', '다음 시트가 생성되었습니다:\n' + created.join(', '), SpreadsheetApp.getUi().ButtonSet.OK);
      } catch (e) {}
    }
  } else {
    Logger.log('record, RecordSummary 시트가 이미 존재합니다.');
  }
  return created;
}

/** 시트 이름으로 찾기 (대소문자 무시, 앞뒤 공백 무시) */
function getSheetByNameIgnoreCase(ss, name) {
  var target = String(name).trim().toLowerCase();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    if (String(sheets[i].getName()).trim().toLowerCase() === target) {
      return sheets[i];
    }
  }
  return null;
}

function getOrCreateRecordSheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RECORD) || getSheetByNameIgnoreCase(ss, SHEETS.RECORD);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.RECORD);
    sheet.getRange(1, 1, 1, RECORD_HEADERS.length).setValues([RECORD_HEADERS]);
  }
  return sheet;
}

function getOrCreateRecordSummarySheet() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RECORD_SUMMARY);
  if (!sheet) {
    sheet = ss.insertSheet(SHEETS.RECORD_SUMMARY);
    sheet.getRange(1, 1, 1, 2).setValues([['student_id', 'summary_evaluation']]);
  }
  return sheet;
}

function ensureRecordSheet() {
  getOrCreateRecordSheet();
  getOrCreateRecordSummarySheet();
  return { success: true };
}

/** record 시트에 기록이 있는 학번 목록(중복 제거) — 카드에 Updated 표시용 */
function getRecordUpdatedIds() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RECORD) || getSheetByNameIgnoreCase(ss, SHEETS.RECORD);
  if (!sheet) {
    return { success: true, data: { student_ids: [] } };
  }
  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 2) {
    return { success: true, data: { student_ids: [] } };
  }
  var headers = data[0].map(function (h) { return String(h).trim(); });
  var sidCol = findCol(headers, '학번', 0);
  var seen = {};
  var ids = [];
  for (var i = 1; i < data.length; i++) {
    var v = data[i][sidCol];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    var sid = String(v).trim();
    var key = sid;
    var num = parseInt(sid, 10);
    if (!isNaN(num)) key = 'n' + num;
    if (!seen[key]) {
      seen[key] = true;
      ids.push(sid);
    }
  }
  return { success: true, data: { student_ids: ids } };
}

/** 두 값이 같은 학번으로 간주되는지 (문자열·숫자·앞뒤공백·앞자리 0 무시) */
function isSameStudentId(a, b) {
  var sa = String(a != null ? a : '').trim();
  var sb = String(b != null ? b : '').trim();
  if (sa === sb) return true;
  var na = parseInt(sa, 10);
  var nb = parseInt(sb, 10);
  if (!isNaN(na) && !isNaN(nb) && na === nb) return true;
  if (sa.length > 0 && sb.length > 0 && sa.replace(/^0+/, '') === sb.replace(/^0+/, '')) return true;
  return false;
}

/** 헤더 배열에서 열 이름으로 열 인덱스 찾기 (먼저 정확 일치, 없으면 포함) */
function findCol(headers, name, fallbackIdx) {
  var n = String(name).trim();
  for (var i = 0; i < headers.length; i++) {
    var h = String(headers[i] || '').trim();
    if (h === n) return i;
  }
  for (var j = 0; j < headers.length; j++) {
    var h2 = String(headers[j] || '').trim();
    if (h2.indexOf(n) >= 0) return j;
  }
  return (fallbackIdx >= 0 && fallbackIdx < headers.length) ? fallbackIdx : 0;
}

function getRecordByStudent(studentId, params) {
  params = params || {};
  if (!studentId) return { success: false, error: 'student_id required' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEETS.RECORD) || getSheetByNameIgnoreCase(ss, SHEETS.RECORD);
  if (!sheet) {
    sheet = getOrCreateRecordSheet();
  }
  var data = sheet.getDataRange().getValues();
  if (!data || data.length < 1) {
    return { success: true, data: { profile: { student_id: String(studentId).trim(), name: '', hope_career: '' }, rows: [], summary_evaluation: '', cell_ref_map: {} } };
  }
  var rawHeaders = data[0].map(String);
  var headers = rawHeaders.map(function (h) { return String(h).trim(); });
  var sidCol = findCol(headers, '학번', 0);
  var nameCol = findCol(headers, '이름', 1);
  var hopeCol = findCol(headers, '희망진로', 2);
  var yearCol = findCol(headers, '학년', 3);
  var areaCol = findCol(headers, '영역', 4);
  var summaryCol = findCol(headers, '기록내용 요약', 5);
  var individualCol = findCol(headers, '개별/단체', 6);
  var academicCol = findCol(headers, '학업역량', 7);
  var careerCol = findCol(headers, '진로역량', 8);
  var communityCol = findCol(headers, '공동체역량', 9);
  var detailCol = findCol(headers, '세부역량', 10);
  var linkCol = 11;
  for (var c = 0; c < headers.length; c++) {
    if (headers[c].indexOf('연속적') >= 0 && headers[c].indexOf('셀') >= 0) { linkCol = c; break; }
  }
  var bookCol = findCol(headers, '읽은 책', 12);
  var evalCol = findCol(headers, '평가', 13);

  var sidStr = String(studentId).trim();
  var rows = [];
  var profile = { student_id: sidStr, name: '', hope_career: '' };
  // 기록별로 학번·이름이 행마다 반복 입력된 구조: 같은 학번인 모든 행을 한 학생의 기록으로 모음 (중복 제거하지 않음)
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var cellVal = row[sidCol];
    if (cellVal !== undefined && cellVal !== null && String(cellVal).trim() === '') continue;
    if (!isSameStudentId(cellVal, studentId)) continue;
    if (profile.name === '' && nameCol >= 0) profile.name = String(row[nameCol] || '').trim();
    if (profile.hope_career === '' && hopeCol >= 0) profile.hope_career = String(row[hopeCol] || '').trim();
    var obj = {
      student_id: String(row[sidCol] || '').trim(),
      name: nameCol >= 0 ? String(row[nameCol] || '').trim() : '',
      hope_career: hopeCol >= 0 ? String(row[hopeCol] || '').trim() : '',
      grade: yearCol >= 0 ? String(row[yearCol] || '').trim() : '',
      area: areaCol >= 0 ? String(row[areaCol] || '').trim() : '',
      record_summary: summaryCol >= 0 ? String(row[summaryCol] || '').trim() : '',
      individual_group: individualCol >= 0 ? String(row[individualCol] || '').trim() : '',
      academic: academicCol >= 0 ? String(row[academicCol] || '').trim() : '',
      career: careerCol >= 0 ? String(row[careerCol] || '').trim() : '',
      community: communityCol >= 0 ? String(row[communityCol] || '').trim() : '',
      detail_competency: detailCol >= 0 ? String(row[detailCol] || '').trim() : '',
      link_cell: linkCol >= 0 ? String(row[linkCol] || '').trim() : '',
      books: bookCol >= 0 ? String(row[bookCol] || '').trim() : '',
      evaluation: evalCol >= 0 ? String(row[evalCol] || '').trim() : '',
      _rowIndex: i + 1
    };
    rows.push(obj);
  }

  var cellRefMap = {};
  for (var j = 0; j < rows.length; j++) {
    var r = rows[j];
    var ref = (r.link_cell || '').trim();
    if (!ref) continue;
    try {
      var range = sheet.getRange(ref);
      if (range) {
        var refRowIndex = range.getRow();
        var refRow = refRowIndex <= data.length ? data[refRowIndex - 1] : [];
        var refSummary = summaryCol >= 0 && refRow[summaryCol] != null ? String(refRow[summaryCol]).trim() : '';
        cellRefMap[ref] = refSummary;
      }
    } catch (e) {
      cellRefMap[ref] = '(참조 오류)';
    }
  }

  var summaryEval = '';
  var sumSheet = ss.getSheetByName(SHEETS.RECORD_SUMMARY) || getSheetByNameIgnoreCase(ss, SHEETS.RECORD_SUMMARY);
  if (sumSheet) {
    var sumData = sumSheet.getDataRange().getValues();
    var sumHeaders = sumData[0].map(String);
    var sumSidCol = sumHeaders.indexOf('student_id');
    var sumEvalCol = sumHeaders.indexOf('summary_evaluation');
    if (sumSidCol >= 0 && sumEvalCol >= 0) {
      for (var k = 1; k < sumData.length; k++) {
        if (String(sumData[k][sumSidCol] || '').trim() === sidStr) {
          summaryEval = String(sumData[k][sumEvalCol] || '').trim();
          break;
        }
      }
    }
  }

  var payload = {
    profile: profile,
    rows: rows,
    summary_evaluation: summaryEval,
    cell_ref_map: cellRefMap
  };
  if (rows.length === 0 && data.length > 1) {
    var samples = [];
    for (var s = 1; s < Math.min(6, data.length); s++) {
      samples.push(String(data[s][sidCol] != null ? data[s][sidCol] : '').trim());
    }
    payload._debug = {
      requested_student_id: sidStr,
      record_sheet_rows: data.length - 1,
      sid_column_index: sidCol,
      sample_ids_from_sheet: samples
    };
  }
  return { success: true, data: payload };
}

function getRecordSummaryEvaluation(studentId) {
  if (!studentId) return { success: false, error: 'student_id required' };
  var sheet = getOrCreateRecordSummarySheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var sidCol = headers.indexOf('student_id');
  var evalCol = headers.indexOf('summary_evaluation');
  var sidStr = String(studentId).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][sidCol] || '').trim() === sidStr) {
      return { success: true, data: { summary_evaluation: String(data[i][evalCol] || '').trim() } };
    }
  }
  return { success: true, data: { summary_evaluation: '' } };
}

function updateRecordSummaryEvaluation(studentId, summaryEvaluation) {
  if (!studentId) return { success: false, error: 'student_id required' };
  var sheet = getOrCreateRecordSummarySheet();
  var data = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var sidCol = headers.indexOf('student_id');
  var evalCol = headers.indexOf('summary_evaluation');
  var sidStr = String(studentId).trim();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][sidCol] || '').trim() === sidStr) {
      sheet.getRange(i + 1, evalCol + 1).setValue(summaryEvaluation != null ? String(summaryEvaluation) : '');
      return { success: true };
    }
  }
  sheet.appendRow([sidStr, summaryEvaluation != null ? String(summaryEvaluation) : '']);
  return { success: true };
}
