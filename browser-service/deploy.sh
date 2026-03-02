#!/bin/bash
# Deploy Browser Service to Cloud Run
# Usage: ./deploy.sh

set -e

PROJECT_ID="gbeta-a7ea6"
REGION="us-central1"
SERVICE_NAME="browser-service"
IMAGE_NAME="us-central1-docker.pkg.dev/${PROJECT_ID}/crewos-images/${SERVICE_NAME}"

echo "🔧 Building Docker image..."
docker build -t ${IMAGE_NAME}:latest .

echo "📤 Pushing to Artifact Registry..."
docker push ${IMAGE_NAME}:latest

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy ${SERVICE_NAME} \
  --image ${IMAGE_NAME}:latest \
  --region ${REGION} \
  --platform managed \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --concurrency 10 \
  --min-instances 0 \
  --max-instances 3 \
  --allow-unauthenticated \
  --set-env-vars "OPENAI_API_KEY=${OPENAI_API_KEY}"

echo "✅ Deployment complete!"
echo ""
echo "Service URL:"
gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)'
