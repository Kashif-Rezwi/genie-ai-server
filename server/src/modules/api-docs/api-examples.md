# Genie AI Server API Examples

## Authentication Examples

### Register a new user
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!"
  }'
```

### Refresh token
```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "your-refresh-token"
  }'
```

## AI Chat Examples

### Start a new chat
```bash
curl -X POST http://localhost:3000/api/ai/chat \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Hello, how can you help me today?",
    "model": "gpt-4",
    "stream": false
  }'
```

### Stream chat response
```bash
curl -X POST http://localhost:3000/api/ai/chat/stream \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Write a short story about a robot",
    "model": "gpt-4",
    "stream": true
  }'
```

### Get chat history
```bash
curl -X GET "http://localhost:3000/api/ai/chat/history?page=1&limit=10" \
  -H "Authorization: Bearer your-jwt-token"
```

## Credits Examples

### Get credit balance
```bash
curl -X GET http://localhost:3000/api/credits/balance \
  -H "Authorization: Bearer your-jwt-token"
```

### Get transaction history
```bash
curl -X GET "http://localhost:3000/api/credits/transactions?page=1&limit=20" \
  -H "Authorization: Bearer your-jwt-token"
```

### Add credits (Admin only)
```bash
curl -X POST http://localhost:3000/api/credits/add \
  -H "Authorization: Bearer your-admin-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "amount": 100,
    "description": "Welcome bonus"
  }'
```

## Payment Examples

### Create payment
```bash
curl -X POST http://localhost:3000/api/payments/create \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "package-id",
    "amount": 2999,
    "currency": "INR"
  }'
```

### Verify payment
```bash
curl -X POST http://localhost:3000/api/payments/verify \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "pay_1234567890",
    "razorpayPaymentId": "pay_razorpay_id",
    "razorpaySignature": "signature"
  }'
```

### Get payment history
```bash
curl -X GET "http://localhost:3000/api/payments/history?page=1&limit=10" \
  -H "Authorization: Bearer your-jwt-token"
```

## User Management Examples

### Get user profile
```bash
curl -X GET http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer your-jwt-token"
```

### Update user profile
```bash
curl -X PUT http://localhost:3000/api/users/profile \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com"
  }'
```

### Change password
```bash
curl -X PUT http://localhost:3000/api/users/change-password \
  -H "Authorization: Bearer your-jwt-token" \
  -H "Content-Type: application/json" \
  -d '{
    "currentPassword": "OldPassword123!",
    "newPassword": "NewPassword123!"
  }'
```

## Monitoring Examples

### Get system health
```bash
curl -X GET http://localhost:3000/api/health
```

### Get performance metrics
```bash
curl -X GET http://localhost:3000/api/performance/metrics \
  -H "Authorization: Bearer your-jwt-token"
```

### Get cache statistics
```bash
curl -X GET http://localhost:3000/api/performance/cache/stats \
  -H "Authorization: Bearer your-jwt-token"
```

## Error Handling Examples

### Validation Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "error": {
    "code": "VALIDATION_ERROR",
    "details": {
      "email": ["Email must be a valid email address"],
      "password": ["Password must be at least 8 characters long"]
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890"
}
```

### Authentication Error Response
```json
{
  "success": false,
  "message": "Unauthorized",
  "error": {
    "code": "UNAUTHORIZED",
    "details": "Invalid or expired token"
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890"
}
```

### Rate Limit Error Response
```json
{
  "success": false,
  "message": "Rate limit exceeded",
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "details": {
      "limit": 100,
      "remaining": 0,
      "resetTime": "2024-01-15T11:00:00.000Z"
    }
  },
  "timestamp": "2024-01-15T10:30:00.000Z",
  "requestId": "req_1234567890"
}
```

## Rate Limiting Examples

### Check rate limit status
```bash
curl -X GET http://localhost:3000/api/rate-limit/status \
  -H "Authorization: Bearer your-jwt-token"
```

### Rate limit headers in response
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
X-RateLimit-Retry-After: 3600
```

## Webhook Examples

### Razorpay webhook
```bash
curl -X POST http://localhost:3000/api/payments/webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: webhook-signature" \
  -d '{
    "event": "payment.captured",
    "payload": {
      "payment": {
        "id": "pay_1234567890",
        "amount": 2999,
        "currency": "INR",
        "status": "captured"
      }
    }
  }'
```

## SDK Examples

### JavaScript/Node.js
```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Start a chat
const chatResponse = await api.post('/ai/chat', {
  message: 'Hello, how are you?',
  model: 'gpt-4',
  stream: false
});

console.log(chatResponse.data);
```

### Python
```python
import requests

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Get credit balance
response = requests.get(
    'http://localhost:3000/api/credits/balance',
    headers=headers
)

print(response.json())
```

### cURL with environment variables
```bash
export API_BASE_URL="http://localhost:3000/api"
export JWT_TOKEN="your-jwt-token"

# Get user profile
curl -X GET "$API_BASE_URL/users/profile" \
  -H "Authorization: Bearer $JWT_TOKEN"
```
