// okx-sign.js
const crypto = require('crypto');

// Preencha com seus dados:
const apiKey = '05f0826d-b525-4e09-a98d-73132c213390';
const apiSecret = '4040C07077E747FEE3D70984DF2BF5DC';
const passphrase = 'Helisilva@2025';

const timestamp = new Date().toISOString();
const method = 'GET';
const requestPath = '/api/v5/trade/fills';
const body = '';

const prehash = `${timestamp}${method.toUpperCase()}${requestPath}${body}`;
const sign = crypto.createHmac('sha256', apiSecret).update(prehash).digest('base64');

console.log('curl -X GET "https://www.okx.com/api/v5/trade/fills?instId=USDT-BRL&limit=20" \\');
console.log(`  -H "OK-ACCESS-KEY: ${apiKey}" \\`);
console.log(`  -H "OK-ACCESS-SIGN: ${sign}" \\`);
console.log(`  -H "OK-ACCESS-TIMESTAMP: ${timestamp}" \\`);
console.log(`  -H "OK-ACCESS-PASSPHRASE: ${passphrase}" \\`);
console.log('  -H "Content-Type: application/json"');