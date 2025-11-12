// test-inter-api.js
const https = require('https');
const fs = require('fs');
const axios = require('axios');

const INTER_API_URL = 'https://cdpj-sandbox.partners.uatinter.co';
const CLIENT_ID = 'seu_client_id';
const CLIENT_SECRET = 'seu_client_secret';
const CERT_PATH = '../inter-keys/certificado.crt';
const KEY_PATH = '../inter-keys/chave_privada.key';
const CONTA_CORRENTE = '12345678';

// Configurar HTTPS Agent com certificado
const httpsAgent = new https.Agent({
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH),
  rejectUnauthorized: true,
});

async function getToken() {
  console.log('🔐 Obtendo token...');
  
  const response = await axios.post(
    `${INTER_API_URL}/oauth/v2/token`,
    new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'client_credentials',
      scope: 'extrato.read boleto-cobranca.read pix.read pix.write',
    }),
    {
      httpsAgent,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  console.log('✅ Token obtido:', response.data.access_token.substring(0, 50) + '...');
  return response.data.access_token;
}

async function getSaldo(token) {
  console.log('\n💰 Consultando saldo...');
  
  const response = await axios.get(
    `${INTER_API_URL}/banking/v2/saldo`,
    {
      httpsAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-conta-corrente': CONTA_CORRENTE,
      },
    }
  );

  console.log('✅ Saldo:', response.data);
  return response.data;
}

async function getExtrato(token) {
  console.log('\n📊 Consultando extrato...');
  
  const dataInicio = '2025-11-01';
  const dataFim = '2025-11-12';
  
  const response = await axios.get(
    `${INTER_API_URL}/banking/v2/extrato?dataInicio=${dataInicio}&dataFim=${dataFim}`,
    {
      httpsAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-conta-corrente': CONTA_CORRENTE,
      },
    }
  );

  console.log('✅ Transações:', response.data.transacoes?.length || 0);
  console.log(JSON.stringify(response.data, null, 2));
  return response.data;
}

async function getChavesPix(token) {
  console.log('\n🔑 Listando chaves Pix...');
  
  const response = await axios.get(
    `${INTER_API_URL}/banking/v2/pix/chaves`,
    {
      httpsAgent,
      headers: {
        'Authorization': `Bearer ${token}`,
        'x-conta-corrente': CONTA_CORRENTE,
      },
    }
  );

  console.log('✅ Chaves Pix:', response.data);
  return response.data;
}

async function main() {
  try {
    const token = await getToken();
    
    await getSaldo(token);
    await getExtrato(token);
    await getChavesPix(token);
    
    console.log('\n🎉 Todos os testes concluídos!');
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    console.error('Status:', error.response?.status);
    console.error('Headers:', error.response?.headers);
  }
}

main();