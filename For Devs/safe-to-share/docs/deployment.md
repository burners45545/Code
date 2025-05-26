# Deployment Guide

This guide covers deploying the URL Counter Tool to various cloud platforms.

## Prerequisites

- Docker and Docker Compose installed
- Cloud provider CLI tools configured
- Access to cloud resources

## General Deployment Steps

1. Build the Docker image:
```bash
docker-compose build
```

2. Test locally:
```bash
docker-compose up -d
```

3. Configure environment variables for production

## AWS ECS Deployment

1. Create an ECR repository:
```bash
aws ecr create-repository --repository-name url-counter
```

2. Push to ECR:
```bash
aws ecr get-login-password --region region | docker login --username AWS --password-stdin aws_account_id.dkr.ecr.region.amazonaws.com
docker tag url-counter:latest aws_account_id.dkr.ecr.region.amazonaws.com/url-counter:latest
docker push aws_account_id.dkr.ecr.region.amazonaws.com/url-counter:latest
```

3. Create ECS cluster:
```bash
aws ecs create-cluster --cluster-name url-counter-cluster
```

4. Create task definition and service using the AWS Console or CLI

## Google Cloud Run

1. Enable required APIs:
```bash
gcloud services enable run.googleapis.com
```

2. Build and push to Google Container Registry:
```bash
gcloud builds submit --tag gcr.io/project-id/url-counter
```

3. Deploy to Cloud Run:
```bash
gcloud run deploy url-counter \
  --image gcr.io/project-id/url-counter \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Azure Container Apps

1. Create Azure Container Registry:
```bash
az acr create --name urlcounter --resource-group mygroup --sku Basic
```

2. Build and push:
```bash
az acr build --registry urlcounter --image url-counter:latest .
```

3. Create Container App:
```bash
az containerapp create \
  --name url-counter \
  --resource-group mygroup \
  --image urlcounter.azurecr.io/url-counter:latest
```

## Production Considerations

### Security
- Use HTTPS
- Set up WAF
- Configure network security groups
- Use secrets management

### Scaling
- Configure auto-scaling
- Set up load balancing
- Monitor resource usage

### Monitoring
- Set up logging aggregation
- Configure alerts
- Monitor metrics with Prometheus/Grafana

### Database
- Use managed database services
- Configure backups
- Set up replication

### Caching
- Use managed Redis service
- Configure proper cache policies
- Monitor cache hit rates

## Troubleshooting

### Common Issues

1. Container fails to start:
- Check logs: `docker logs container_id`
- Verify environment variables
- Check resource limits

2. Database connection issues:
- Verify connection strings
- Check network security rules
- Validate credentials

3. Performance issues:
- Monitor resource usage
- Check scaling settings
- Analyze slow queries

## Maintenance

### Updates
1. Build new image version
2. Test in staging
3. Deploy to production
4. Monitor for issues

### Backups
1. Database backups
2. Configuration backups
3. Log archives

### Monitoring
1. Set up alerts
2. Monitor metrics
3. Review logs regularly 