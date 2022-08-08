#!/usr/bin/env node
import 'source-map-support/register'
import * as cdk from '@aws-cdk/core'
import { PasswordlessAuthStack } from '../lib/passwordless-login-stack'

const app = new cdk.App()
new PasswordlessAuthStack(app, 'PasswordlessAuthStack', {
  env: { region: process.env.REGION || 'us-west-1' },
})
