import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';

export class OrderStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const table = new dynamodb.Table(this, 'OrdersTable', {
      partitionKey: { name: 'orderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST
    });

    new ssm.StringParameter(this, 'OrdersTableParam', {
      parameterName: '/orders/tableName',
      stringValue: table.tableName
    });

    const orderLambda = new lambda.Function(this, 'OrderLambda', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambda')),
      environment: {
        SSM_PARAM: '/orders/tableName'
      }
    });

    table.grantReadWriteData(orderLambda);

    orderLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [`arn:aws:ssm:${this.region}:${this.account}:parameter/orders/tableName`]
    }));

    const api = new apigw.RestApi(this, 'OrderApi', {
      restApiName: 'Order Service'
    });

    const order = api.root.addResource('order');
    order.addMethod('GET', new apigw.LambdaIntegration(orderLambda));
    order.addMethod('POST', new apigw.LambdaIntegration(orderLambda));
  }
}