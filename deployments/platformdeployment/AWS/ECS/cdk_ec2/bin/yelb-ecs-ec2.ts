#!/usr/bin/env node
import { Construct } from 'constructs';
import { App, Stack } from 'aws-cdk-lib';                 // core constructs

import { YelbEcsEc2Stack } from '../lib/yelb-ecs-ec2-stack';

const app = new App();
new YelbEcsEc2Stack(app, 'YelbEcsEc2Stack');
