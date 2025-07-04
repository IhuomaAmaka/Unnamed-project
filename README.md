# Order API Project

## Business Use Case
This API processes e-commerce orders. You can retrieve orders or submit new ones. New orders are processed via a microservice running in EKS, and responses are stored in DynamoDB.

## Components
- **API Gateway**: Exposes `/order` GET & POST
- **Lambda**: Backend for API
- **DynamoDB**: Stores order records
- **SSM Parameter Store**: Holds table name
- **EKS Microservice**: Simulated order processor

## Steps to Run

### 1. Install Dependencies
```
npm install -g aws-cdk
cd cdk
npm install
```

### 2. Bootstrap & Deploy CDK
```
cdk bootstrap aws://352722532924/us-east-1
cdk deploy --app "npx ts-node bin/cdk.ts"
```

### 3. Run Local EKS Simulation
```
cd eks-microservice
npm install
node index.js
```

Update Lambda code to call the correct EKS service URL if testing end-to-end.

## Demonstration
- Use `GET /order?orderId=xyz` to fetch orders
- Use `POST /order` with payload to create orders

## Explanation
- Decoupled architecture using API Gateway, Lambda, EKS, and DynamoDB
- Table name managed via SSM
- CI/CD with GitHub Actions for CDK deployment