import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand
} from "@aws-sdk/client-dynamodb";

import {
  SSMClient,
  GetParameterCommand
} from "@aws-sdk/client-ssm";

import https from "https";

const ssm = new SSMClient({});
const dynamodb = new DynamoDBClient({});
let tableNameCache;

const getTableName = async () => {
  if (tableNameCache) return tableNameCache;
  const res = await ssm.send(new GetParameterCommand({
    Name: process.env.SSM_PARAM
  }));
  tableNameCache = res.Parameter.Value;
  return tableNameCache;
};

export const handler = async (event) => {
  const method = event.httpMethod;

  if (method === 'GET') {
    const orderId = event.queryStringParameters?.orderId;
    if (!orderId) return { statusCode: 400, body: 'Missing orderId' };

    const table = await getTableName();
    const result = await dynamodb.send(
      new GetItemCommand({
        TableName: table,
        Key: {
          orderId: { S: orderId }
        }
      })
    );
    return {
      statusCode: 200,
      body: JSON.stringify(result.Item || {})
    };
  }

  if (method === 'POST') {
    const body = JSON.parse(event.body);
    const eksData = await callEksService(body);
    const table = await getTableName();

    await dynamodb.send(new PutItemCommand({
      TableName: table,
      Item: {
        orderId: { S: eksData.orderId },
        status: { S: eksData.status },
        details: { S: eksData.details }
      }
    }));

    return { statusCode: 200, body: JSON.stringify(eksData) };
  }

  return { statusCode: 405, body: 'Method Not Allowed' };
};

const callEksService = (payload) => {
  const url = 'https://48b1-76-67-62-151.ngrok-free.app/process-order';

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(JSON.parse(data));
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};
