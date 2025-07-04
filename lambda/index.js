const AWS = require('aws-sdk');
const ssm = new AWS.SSM();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const https = require('https');

let tableNameCache;

const getTableName = async () => {
  if (tableNameCache) return tableNameCache;

  console.log("Fetching SSM parameter:", process.env.SSM_PARAM);

  if (!process.env.SSM_PARAM) {
    console.error("SSM_PARAM environment variable is not defined!");
    throw new Error("Missing environment variable: SSM_PARAM");
  }

  try {
    const res = await ssm.getParameter({
      Name: process.env.SSM_PARAM
    }).promise();

    console.log("Fetched DynamoDB table name from SSM:", res.Parameter.Value);
    tableNameCache = res.Parameter.Value;
    return tableNameCache;

  } catch (error) {
    console.error("Error fetching SSM parameter:", error);
    throw new Error("Failed to fetch DynamoDB table name from SSM");
  }
};

exports.handler = async (event) => {
  console.log("Incoming event:", JSON.stringify(event));

  const method = event.httpMethod;

  try {
    if (method === 'GET') {
      const orderId = event.queryStringParameters?.orderId;
      if (!orderId) {
        console.log("Missing orderId in GET request");
        return {
          statusCode: 400,
          body: JSON.stringify({ error: 'Missing orderId' }),
        };
      }

      const table = await getTableName();
      const result = await dynamodb.get({
        TableName: table,
        Key: { orderId }
      }).promise();

      console.log("DynamoDB GET result:", result);

      return {
        statusCode: 200,
        body: JSON.stringify(result.Item || {}),
      };
    }

    if (method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      console.log("POST request body:", body);

      const eksData = await callEksService(body);
      console.log("Response from EKS service:", eksData);

      const table = await getTableName();

      await dynamodb.put({
        TableName: table,
        Item: {
          orderId: eksData.orderId,
          status: eksData.status,
          details: eksData.details,
        },
      }).promise();

      console.log("Inserted item into DynamoDB.");

      return {
        statusCode: 200,
        body: JSON.stringify(eksData),
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };

  } catch (error) {
    console.error("Handler error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", message: error.message }),
    };
  }
};

const callEksService = (payload) => {
  const url = new URL('https://48b1-76-67-62-151.ngrok-free.app/process-order');

  const options = {
    hostname: url.hostname,
    port: url.port || 443,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          console.error("Failed to parse JSON response from EKS service:", data);
          reject(err);
        }
      });
    });

    req.on('error', (err) => {
      console.error("HTTPS request error:", err);
      reject(err);
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
};
