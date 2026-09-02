// src/services/smsService.js
const axios = require('axios');

const POWER_TEXT_BASE_URL = process.env.POWER_TEXT_BASE_URL || '';
const POWER_TEXT_AUTH_KEY = process.env.POWER_TEXT_AUTH_KEY || '';
const POWER_TEXT_SENDER_ID = process.env.POWER_TEXT_SENDER_ID || '';
const POWER_TEXT_ROUTE = process.env.POWER_TEXT_ROUTE || '1';
const POWER_TEXT_TEMPLATE_ID = process.env.POWER_TEXT_TEMPLATE_ID || '';

let smsConfigLogged = false;

function logSmsConfigOnce() {
  if (smsConfigLogged) return;
  smsConfigLogged = true;

  console.log('[SMS CONFIG] BASE_URL:', POWER_TEXT_BASE_URL || '(missing)');
  console.log('[SMS CONFIG] AUTH_KEY:', POWER_TEXT_AUTH_KEY ? '(set)' : '(missing)');
  console.log('[SMS CONFIG] SENDER_ID:', POWER_TEXT_SENDER_ID || '(missing)');
  console.log('[SMS CONFIG] ROUTE:', POWER_TEXT_ROUTE || '(missing)');
  console.log('[SMS CONFIG] TEMPLATE_ID:', POWER_TEXT_TEMPLATE_ID || '(missing)');
}

async function sendOtpSms(contact, otp) {
  // Template: "Dear {#var#}, your OTP for login is {#var#}. Please do not share this code with anyone. Best regards, Team Perfect Pizza F2 CLICK"

  // Pehla {#var#} – naam / generic text, dusra {#var#} – OTP
  const nameVar = 'Customer'; // ya "User", ya existing user ka naam agar pass karna chaho

  const message = `Dear ${nameVar}, your OTP for login is ${otp}. Please do not share this code with anyone. Best regards, Team Perfect Pizza F2 CLICK`;

  logSmsConfigOnce();

  console.log(
    `[SMS DEBUG] OTP for ${contact}: ${otp} | Message: ${message}`
  );

  const missing = [];
  if (!POWER_TEXT_BASE_URL) missing.push('POWER_TEXT_BASE_URL');
  if (!POWER_TEXT_AUTH_KEY) missing.push('POWER_TEXT_AUTH_KEY');
  if (!POWER_TEXT_SENDER_ID) missing.push('POWER_TEXT_SENDER_ID');
  if (!POWER_TEXT_TEMPLATE_ID) missing.push('POWER_TEXT_TEMPLATE_ID');

  if (missing.length > 0) {
    console.log(
      '[SMS MOCK] PowerText config incomplete, missing:',
      missing.join(', ')
    );
    console.log('[SMS MOCK] Skipping real SMS HTTP call.');
    return;
  }

  try {
    const params = {
      'authentic-key': POWER_TEXT_AUTH_KEY,
      senderid: POWER_TEXT_SENDER_ID,
      route: POWER_TEXT_ROUTE,
      number: contact,
      message,
      templateid: POWER_TEXT_TEMPLATE_ID
    };

    const resp = await axios.get(POWER_TEXT_BASE_URL, { params });

    console.log(
      `Real OTP SMS request sent to ${contact}. Provider response:`,
      resp.data
    );
  } catch (err) {
    console.error(
      'Failed to send OTP SMS:',
      err.response?.data || err.message
    );
  }
}
module.exports = { sendOtpSms };