# ERP Nexus API Gateway

Centralized API Gateway for the ERP Nexus microservices architecture. This gateway provides unified routing, authentication, rate limiting, and monitoring for all backend modules.

## 🌟 Features

- **Unified Routing**: Single entry point for all API requests
- **Centralized Authentication**: JWT validation with User Management service
- **Multi-tenancy Support**: Company isolation through request headers
- **Rate Limiting**: Configurable limits per endpoint and user
- **Health Monitoring**: Comprehensive health checks for all services
- **Security Headers**: Helmet.js integration for security best practices
- **Request Logging**: Detailed logging with Winston
- **CORS Management**: Centralized CORS configuration
- **Error Handling**: Standardized error responses
- **Performance Monitoring**: Request timing and metrics

## 🏗️ Architecture

```
Frontend (Port 3000)
    ↓
API Gateway (Port 5001)
    ├── /api/auth/* → User Management (Port 3001)
    ├── /api/crm/* → CRM Module (Port 3002)
    ├── /api/services/* → Services Module (Port 3003)
    └── /api/agendamento/* → Scheduling Module (Port 3004)
```

## 📁 Project Structure

```
modules/api-gateway/
├── src/
│   ├── server.ts              # Main server entry point
│   ├── routes/                # Route modules
│   │   ├── auth.ts           # Authentication routes
│   │   ├── crm.ts            # CRM module proxy
│   │   ├── services.ts       # Services module proxy
│   │   └── agendamento.ts    # Scheduling module proxy
│   ├── middleware/           # Custom middleware
│   │   ├── auth.ts          # Authentication middleware
│   │   └── logging.ts       # Request logging middleware
│   └── utils/               # Utility modules
│       ├── healthCheck.ts   # Health check system
│       └── logger.ts        # Winston logger configuration
├── logs/                    # Log files (created automatically)
├── package.json
├── tsconfig.json
├── Dockerfile
└── README.md
```

## 🚀 Quick Start

### Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

3. **Start in development mode**:
   ```bash
   npm run dev
   ```

### Production

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

### Docker

```bash
# Build the container
docker build -t nexus-api-gateway .

# Run the container
docker run -p 5001:5001 nexus-api-gateway
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Gateway server port | `5001` |
| `USER_MANAGEMENT_URL` | User Management service URL | `http://nexus-user-management:3001` |
| `CRM_URL` | CRM service URL | `http://nexus-crm:3002` |
| `SERVICES_URL` | Services module URL | `http://nexus-services:3003` |
| `AGENDAMENTO_URL` | Scheduling service URL | `http://nexus-agendamento:3004` |
| `JWT_SECRET` | JWT secret for validation | Required |
| `LOG_LEVEL` | Logging level | `info` |

### Rate Limiting

The gateway implements several rate limiting strategies:

- **Global**: 1000 requests per 15 minutes per IP
- **Authentication**: 50 requests per 15 minutes per IP
- **Login**: 10 requests per 15 minutes per IP
- **Service-specific**: Custom limits per module

## 📡 API Endpoints

### Health & Status

- `GET /health` - Overall system health
- `GET /health/:service` - Individual service health
- `GET /health/metrics/detailed` - Detailed metrics
- `GET /ping` - Simple connectivity check

### Authentication (Public)

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/validate` - Token validation
- `POST /api/auth/refresh` - Token refresh

### Protected Routes (Require Authentication)

- `/api/crm/*` - CRM module endpoints
- `/api/services/*` - Services module endpoints
- `/api/agendamento/*` - Scheduling module endpoints

## 🔐 Authentication Flow

1. **Client** sends login request to `/api/auth/login`
2. **Gateway** proxies to User Management service
3. **User Management** validates credentials and returns JWT
4. **Client** includes JWT in subsequent requests (`Authorization: Bearer <token>`)
5. **Gateway** validates JWT with User Management service
6. **Gateway** adds user context headers (`X-Company-ID`, `X-User-ID`) to proxied requests

## 🏥 Health Monitoring

The gateway provides comprehensive health monitoring:

```bash
# Check overall system health
curl http://localhost:5001/health

# Check specific service
curl http://localhost:5001/health/crm

# Get detailed metrics
curl http://localhost:5001/health/metrics/detailed
```

Health check responses include:
- Service availability
- Response times
- Memory usage
- Uptime statistics
- Error details

## 📊 Logging

Winston-based logging with multiple levels:

- **error**: Critical errors and exceptions
- **warn**: Warning conditions (rate limits, auth failures)
- **info**: General operational messages
- **http**: HTTP request/response details
- **debug**: Detailed debugging information

Logs are written to:
- Console (always)
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- `logs/requests.log` - HTTP request logs

## 🛡️ Security Features

- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin requests
- **Rate Limiting**: DDoS protection
- **JWT Validation**: Secure authentication
- **Request Sanitization**: Input validation
- **Error Handling**: No sensitive data leakage

## 📈 Performance

- **Compression**: Gzip response compression
- **Connection Pooling**: HTTP keep-alive connections
- **Request Timeouts**: Configurable timeouts per service
- **Caching Headers**: Appropriate cache control
- **Memory Management**: Efficient memory usage

## 🔧 Maintenance

### Monitoring Commands

```bash
# Check gateway status
curl http://localhost:5001/ping

# View real-time logs
docker logs -f nexus-api-gateway

# Check service connectivity
curl http://localhost:5001/health
```

### Common Issues

1. **Service Unreachable**: Check Docker network connectivity
2. **Authentication Failures**: Verify User Management service is running
3. **Rate Limit Errors**: Check rate limit configurations
4. **High Response Times**: Monitor service health and performance

## 🧪 Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Integration tests
npm run test:integration
```

## 📝 Development

### Adding a New Service

1. Add service configuration to health check
2. Create new route file in `src/routes/`
3. Add proxy configuration
4. Update main server routes
5. Add environment variables
6. Update documentation

### Debugging

Enable debug logging:
```bash
export LOG_LEVEL=debug
npm run dev
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Follow coding standards
4. Add tests for new features
5. Update documentation
6. Submit pull request

## 📄 License

MIT License - see LICENSE file for details.

---

**Gateway Version**: 1.0.0
**Node.js Version**: >=18.0.0
**Last Updated**: $(date)