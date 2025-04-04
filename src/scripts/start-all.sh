#!/bin/bash

# Get the absolute path to the project root
PROJECT_ROOT="$(cd "$(dirname "$0")/../../" && pwd)"

# Start the Python API server
cd "$PROJECT_ROOT/src/python-api" || exit
echo "Starting Python API server..."
python3 -m uvicorn main:app --reload --port 8000 &
PYTHON_PID=$!

# Start the Next.js frontend
cd "$PROJECT_ROOT" || exit
echo "Starting Next.js frontend..."
yarn dev &
NEXTJS_PID=$!

# Function to handle script termination
function cleanup {
  echo "Shutting down servers..."
  kill $PYTHON_PID
  kill $NEXTJS_PID
  exit
}

# Trap Ctrl+C and call cleanup
trap cleanup INT

# Keep the script running
echo "Both servers are running. Press Ctrl+C to stop."
wait 