#!/usr/bin/env bash
# Rebuild the supergereinaction Docker image and (re)run the container.
set -euo pipefail

IMAGE_NAME="supergereinaction:latest"
CONTAINER_NAME="supergereinaction"
PORT="${PORT:-80}"

cd "$(dirname "$0")/.."

echo "Building $IMAGE_NAME..."
docker build -t "$IMAGE_NAME" .

if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  echo "Removing existing container $CONTAINER_NAME..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi

echo "Starting $CONTAINER_NAME on port $PORT..."
docker run -d --name "$CONTAINER_NAME" -p "${PORT}:80" "$IMAGE_NAME" >/dev/null

echo "Running at http://localhost:${PORT}"
docker ps --filter "name=$CONTAINER_NAME"
