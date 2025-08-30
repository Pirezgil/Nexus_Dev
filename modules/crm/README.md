# Nexus ERP - CRM Module

Customer Relationship Management module for the Nexus ERP system. This module provides comprehensive customer management capabilities including customer profiles, interaction tracking, notes management, and advanced analytics.

## 🚀 Features

- **Customer Management**: Complete CRUD operations for customer data
- **Interaction Tracking**: Track all customer interactions (calls, emails, meetings, etc.)
- **Notes System**: Private and public notes with different types
- **Advanced Search**: Powerful search and filtering capabilities
- **Tags & Segmentation**: Flexible tagging system for customer segmentation
- **Analytics & Reports**: Comprehensive statistics and performance metrics
- **Multi-tenant**: Complete company data isolation
- **Real-time**: Redis caching for optimal performance

## 🏗️ Architecture

### Tech Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for session management and caching
- **Authentication**: JWT integration with User Management module
- **Validation**: Zod for request/response validation
- **Logging**: Winston with structured logging
- **Container**: Docker with multi-stage builds

### Module Structure
```
modules/crm/
├── src/
│   ├── routes/           # Express routes definition
│   ├── controllers/      # Request handlers
│   ├── services/         # Business logic layer
│   ├── middleware/       # Custom middleware
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   └── app.ts           # Express app configuration
├── prisma/
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Database migrations
├── Dockerfile
├── package.json
└── .env.example
```

## 📊 Database Schema

### Core Tables
- **customers**: Main customer information with tags and metadata
- **customer_notes**: Notes and observations about customers
- **customer_interactions**: Complete interaction history
- **customer_stats**: Aggregated statistics (view/materialized)

### Key Features
- UUID primary keys for security
- Company-based data isolation
- Flexible JSON metadata fields
- Comprehensive indexing for performance
- Cascade deletes for data consistency

## 🔗 API Endpoints

### Customer Management
- `GET /api/customers` - List customers with pagination and filters
- `POST /api/customers` - Create new customer
- `GET /api/customers/:id` - Get customer details
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer
- `GET /api/customers/search` - Advanced search
- `GET /api/customers/:id/history` - Customer timeline

### Notes Management
- `GET /api/customers/:id/notes` - Get customer notes
- `POST /api/customers/:id/notes` - Add new note
- `PUT /api/customers/:id/notes/:noteId` - Update note
- `DELETE /api/customers/:id/notes/:noteId` - Delete note

### Interaction Tracking
- `GET /api/customers/:id/interactions` - Get interactions
- `POST /api/customers/:id/interactions` - Create interaction
- `PUT /api/customers/:id/interactions/:id` - Update interaction
- `PATCH /api/customers/:id/interactions/:id/complete` - Mark as completed

### Tags & Segmentation
- `GET /api/customers/tags` - Get all available tags
- `POST /api/customers/:id/tags` - Add tags to customer
- `DELETE /api/customers/:id/tags` - Remove tags from customer

### Analytics
- `GET /api/stats` - Overall statistics
- `GET /api/stats/dashboard` - Dashboard metrics
- `GET /api/stats/performance` - Performance metrics
- `GET /api/stats/customers/:id/activity` - Customer activity summary

### Health & Monitoring
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health with dependencies
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

## 🔐 Security Features

### Authentication & Authorization
- JWT token validation via User Management service
- Company-based data isolation
- Role-based access control (Admin, Manager, User)
- Rate limiting per IP address

### Data Protection
- Input sanitization and validation
- SQL injection prevention with Prisma
- XSS protection with Helmet
- CORS configuration
- Request/response logging

### Privacy
- Private notes (only creator can access)
- User-scoped permissions
- Audit trails for sensitive operations

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

### Installation

1. **Clone and navigate to CRM module**
   ```bash
   cd modules/crm
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Setup database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Run migrations
   npm run db:migrate
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

### Docker Development

1. **Using Docker Compose (recommended)**
   ```bash
   # From project root
   docker-compose up nexus-crm
   ```

2. **Build and run manually**
   ```bash
   docker build -t nexus-crm .
   docker run -p 5004:5000 nexus-crm
   ```

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Lint code
npm run lint

# Type check
npm run type-check
```

## 📝 Environment Variables

### Required Variables
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string  
- `USER_MANAGEMENT_URL`: URL of User Management service
- `JWT_SECRET`: JWT secret for token validation

### Optional Variables
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 5000)
- `CORS_ORIGINS`: Allowed origins for CORS
- `LOG_LEVEL`: Logging level (error/warn/info/debug)
- `RATE_LIMIT_*`: Rate limiting configuration

See `.env.example` for complete configuration options.

## 🔄 Integration

### With User Management
- JWT token validation for all protected routes
- User context injection for multi-tenancy
- Role-based access control
- Session management via Redis

### With Other Modules
- Service discovery via environment variables
- RESTful API communication
- Event publishing via Redis pub/sub
- Shared PostgreSQL database with schema isolation

## 📊 Performance

### Optimization Features
- Redis caching for frequently accessed data
- Database query optimization with proper indexing
- Response compression
- Connection pooling
- Lazy loading for large datasets

### Monitoring
- Structured logging with Winston
- Health check endpoints
- Performance metrics
- Error tracking
- Database query monitoring

## 🔧 Development

### Code Organization
- **Controllers**: Handle HTTP requests/responses
- **Services**: Contain business logic
- **Middleware**: Handle cross-cutting concerns
- **Types**: TypeScript definitions and validation
- **Utils**: Shared utilities and configurations

### Best Practices
- TypeScript strict mode enabled
- Comprehensive error handling
- Input validation with Zod
- Proper logging and monitoring
- Clean architecture principles
- Database transaction management

### Database Migrations
```bash
# Create new migration
npm run db:migrate -- --name migration_name

# Reset database (development only)
npm run db:reset

# View database in Prisma Studio
npm run db:studio
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Stateless application design
- Redis for shared session state
- Load balancer ready
- Container orchestration support

### Performance
- Database read replicas support
- Caching layers at multiple levels
- Async processing for heavy operations
- Connection pooling optimization

## 🤝 Contributing

1. Follow the established code structure
2. Add tests for new features
3. Update documentation
4. Follow TypeScript best practices
5. Ensure proper error handling
6. Add appropriate logging

## 📄 License

This module is part of the Nexus ERP system and follows the same licensing terms.

## 🆘 Support

For issues and questions:
1. Check the health endpoints for service status
2. Review logs for error details  
3. Verify environment configuration
4. Check database connectivity
5. Ensure User Management service is running

---

**Nexus CRM Module** - Part of the Nexus ERP ecosystem for modern business management.