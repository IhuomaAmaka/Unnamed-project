import {
  SSMClient,
  GetParameterCommand
} from "@aws-sdk/client-ssm";

import {
  DynamoDBClient
} from "@aws-sdk/client-dynamodb";

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand
} from "@aws-sdk/lib-dynamodb";

import https from "https";

// Create AWS SDK v3 clients
const ssmClient = new SSMClient();
const dynamoClient = DynamoDBDocumentClient.from(
  new DynamoDBClient()
);

let tableNameCache;

// Retrieve the table name from SSM (and cache it)
const getTableName = async () => {
  if (tableNameCache) return tableNameCache;

  const command = new GetParameterCommand({
    Name: process.env.SSM_PARAM,
  });

  const res = await ssmClient.send(command);
  tableNameCache = res.Parameter.Value;
  return tableNameCache;
};

// Lambda handler
export const handler = async (event) => {
  console.log("Event received:", JSON.stringify(event));

  const method = event.httpMethod;

  if (method === 'GET') {
    const orderId = event.queryStringParameters?.orderId;
    if (!orderId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Missing orderId' }),
      };
    }

    const table = await getTableName();

    const result = await dynamoClient.send(
      new GetCommand({
        TableName: table,
        Key: { orderId },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(result.Item || {}),
    };
  }

  if (method === 'POST') {
    const body = JSON.parse(event.body);
    const eksData = await callEksService(body);
    const table = await getTableName();

    await dynamoClient.send(
      new PutCommand({
        TableName: table,
        Item: {
          orderId: eksData.orderId,
          status: eksData.status,
          details: eksData.details,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(eksData),
    };
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ message: 'Method Not Allowed' }),
  };
};

// Helper to call your EKS microservice
const callEksService = (payload) => {
  const url = 'https://48b1-76-67-62-151.ngrok-free.app/process-order';

  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
};
