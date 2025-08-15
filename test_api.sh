#!/bin/bash

# Set OpenAI environment variables
export OPENAI_API_KEY="your_openai_api_key_here"
export OPENAI_MODEL="gpt-3.5-turbo"
export OPENAI_BASE_URL="https://api.openai.com/v1"

# Test the API endpoint
echo "Testing /api/predictions endpoint..."
curl -X POST http://127.0.0.1:3537/api/predictions \
  -H 'Content-Type: application/json' \
  -d '{
    "currentCommand": "ls -la",
    "context": "Previous commands: cd /home/user, pwd",
    "workingDirectory": "/home/user"
  }'

echo ""
echo "Test completed."