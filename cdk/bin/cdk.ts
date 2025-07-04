#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { OrderStack } from '../lib/order-stack';

const app = new cdk.App();
new OrderStack(app, 'OrderStack');