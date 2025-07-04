const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const https = require('https');

let tableNameCache;

const getTableName = async () => {
  if (tableNameCache) return tableNameCache;
  const res = await ssm.getParameter({ Name: process.env.SSM_PARAM }).promise();
  tableNameCache = res.Parameter.Value;
  return tableNameCache;
};

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'GET') {
    const orderId = event.queryStringParameters?.orderId;
    if (!orderId) return { statusCode: 400, body: 'Missing orderId' };

    const table = await getTableName();
    const result = await dynamodb.get({ TableName: table, Key: { orderId } }).promise();
    return { statusCode: 200, body: JSON.stringify(result.Item || {}) };
  }

  if (method === 'POST') {
    const body = JSON.parse(event.body);
    const eksData = await callEksService(body);
    const table = await getTableName();

    await dynamodb.put({
      TableName: table,
      Item: {
        orderId: eksData.orderId,
        status: eksData.status,
        details: eksData.details
      }
    }).promise();

    return { statusCode: 200, body: JSON.stringify(eksData) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};

const callEksService = (payload) => {
  const options = {
    hostname: 'https://4ipb00v0n1.execute-api.us-east-1.amazonaws.com/prod/',
    port: 443,
    path: '/process-order',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};