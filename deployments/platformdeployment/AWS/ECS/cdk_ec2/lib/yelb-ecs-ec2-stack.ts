import {App, Fn, Tags, Stack, StackProps} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { aws_ec2 as ec2 } from 'aws-cdk-lib';
import { aws_ecs as ecs } from 'aws-cdk-lib';
import { aws_ecs_patterns as ecs_patterns } from 'aws-cdk-lib';
import { aws_servicediscovery as servicediscovery } from 'aws-cdk-lib';

export class YelbEcsEc2Stack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const yelbvpc = new ec2.Vpc(this, "yelb-vpc-ec2", {});

    const yelbcluster = new ecs.Cluster(this, "yelb-cluster-ec2", {
      clusterName: "yelb-cluster-ec2",
      vpc: yelbvpc,
      });

    // Add capacity to it
     yelbcluster.addCapacity('DefaultAutoScalingGroupCapacity', {
       instanceType: new ec2.InstanceType("c5.large"),
       desiredCapacity: 10,
     });

    const yelbnamespace = new servicediscovery.PrivateDnsNamespace(this, 'Namespace', {
      name: 'yelb-ec2.local',
      vpc: yelbvpc,
    }); 

    // ------------------------------------------------------------------------------------------------- //
    const yelbuitaskdef = new ecs.Ec2TaskDefinition(this, "yelb-ui-taskdef", {
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const yelbuicontainer = yelbuitaskdef.addContainer("yelb-ui-container", {
      image: ecs.ContainerImage.fromRegistry("mreferre/yelb-ui:0.10"),
      environment: {"SEARCH_DOMAIN": yelbnamespace.namespaceName},
      memoryLimitMiB: 2048, // Default is 512
      cpu: 512, // Default is 256
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'YelbEcsEc2Stack' })
    })

    yelbuicontainer.addPortMappings({
      containerPort: 80
    });

    // Create a load-balanced Ec2 service and make it public
    const yelbuiservice = new ecs_patterns.ApplicationLoadBalancedEc2Service(this, "yelb-ui-service", {
      cluster: yelbcluster, // Required
      desiredCount: 3, // Default is 1
      publicLoadBalancer: true, // Default is false
      serviceName: "yelb-ui",
      taskDefinition: yelbuitaskdef,
      cloudMapOptions: { name: "yelb-ui", cloudMapNamespace: yelbnamespace},
    });

    // ------------------------------------------------------------------------------------------------- //


    // ------------------------------------------------------------------------------------------------- //

    const yelbappservertaskdef = new ecs.Ec2TaskDefinition(this, "yelb-appserver-taskdef", {
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const yelbappservercontainer = yelbappservertaskdef.addContainer("yelb-appserver-container", {
      image: ecs.ContainerImage.fromRegistry("mreferre/yelb-appserver:0.7"),
      environment: {"SEARCH_DOMAIN": yelbnamespace.namespaceName},
      memoryLimitMiB: 2048, // Default is 512
      cpu: 512, // Default is 256
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'YelbEcsEc2Stack' })
    })

    yelbappservercontainer.addPortMappings({
      containerPort: 4567
    });

    // Create a standard Ec2 service 
    const yelbappserverservice = new ecs.Ec2Service(this, "yelb-appserver-service", {
      cluster: yelbcluster, // Required
      desiredCount: 2, // Default is 1
      serviceName: "yelb-appserver",
      taskDefinition: yelbappservertaskdef,
      cloudMapOptions: { name: "yelb-appserver", cloudMapNamespace: yelbnamespace }
    });    

    yelbappserverservice.connections.allowFrom(yelbuiservice.service, ec2.Port.tcp(4567))

    // ------------------------------------------------------------------------------------------------- //


    // ------------------------------------------------------------------------------------------------- //

    const yelbdbtaskdef = new ecs.Ec2TaskDefinition(this, "yelb-db-taskdef", {
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const yelbdbcontainer = yelbdbtaskdef.addContainer("yelb-db-container", {
      image: ecs.ContainerImage.fromRegistry("mreferre/yelb-db:0.6"),
      memoryLimitMiB: 2048, // Default is 512
      cpu: 512, // Default is 256
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'YelbEcsEc2Stack' })
    })

    yelbdbcontainer.addPortMappings({
      containerPort: 5432
    });

    // Create a standard Ec2 service 
    const yelbdbservice = new ecs.Ec2Service(this, "yelb-db-service", {
      cluster: yelbcluster, // Required
      serviceName: "yelb-db",
      taskDefinition: yelbdbtaskdef,
      cloudMapOptions: { name: "yelb-db", cloudMapNamespace: yelbnamespace}
    });    

    yelbdbservice.connections.allowFrom(yelbappserverservice, ec2.Port.tcp(5432))


    // ------------------------------------------------------------------------------------------------- //


    // ------------------------------------------------------------------------------------------------- //

    const redisservertaskdef = new ecs.Ec2TaskDefinition(this, "redis-server-taskdef", {
      networkMode: ecs.NetworkMode.AWS_VPC
    });

    const redisservercontainer = redisservertaskdef.addContainer("redis-server", {
      image: ecs.ContainerImage.fromRegistry("redis:4.0.2"), 
      memoryLimitMiB: 2048, // Default is 512
      cpu: 512, // Default is 256
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: 'YelbEcsEc2Stack' })
    })

    redisservercontainer.addPortMappings({
      containerPort: 6379
    });

    // Create a standard Ec2 service 
    const redisserverservice = new ecs.Ec2Service(this, "redis-server-service", {
      cluster: yelbcluster, // Required
      serviceName: "redis-server",
      taskDefinition: redisservertaskdef,
      cloudMapOptions: { name: "redis-server", cloudMapNamespace: yelbnamespace}
    });    

    redisserverservice.connections.allowFrom(yelbappserverservice, ec2.Port.tcp(6379))

    // ------------------------------------------------------------------------------------------------- //

  }
}
