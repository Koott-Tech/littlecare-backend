# Kuttikal Backend

A comprehensive Express.js backend for the Kuttikal Child Therapy Platform with role-based authentication and Supabase integration.

## 🚀 Features

- **Role-Based Authentication**: Client, Psychologist, Admin, and Superadmin roles
- **JWT Token Security**: Secure authentication with JSON Web Tokens
- **Supabase Integration**: PostgreSQL database with real-time capabilities
- **Comprehensive API**: Full CRUD operations for all entities
- **Input Validation**: Express-validator for request validation
- **Error Handling**: Centralized error handling and response formatting
- **Rate Limiting**: API rate limiting for security
- **CORS Support**: Cross-origin resource sharing configuration

## 🏗️ Architecture

```
backend/
├── config/          # Configuration files
├── controllers/     # Business logic controllers
├── middleware/      # Authentication and validation middleware
├── routes/          # API route definitions
├── utils/           # Helper functions and utilities
├── uploads/         # File upload directory
├── server.js        # Main server file
└── package.json     # Dependencies
```

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account and project

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   - Copy `env.example` to `.env`
   - Fill in your Supabase credentials:
     ```env
     SUPABASE_URL=your-supabase-project-url
     SUPABASE_ANON_KEY=your-supabase-anon-key
     JWT_SECRET=your-super-secret-jwt-key
     ```

4. **Database Setup**
   - Run the SQL queries provided in the project documentation
   - Ensure all tables are created in your Supabase project

5. **Start the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## 🔐 API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get current user profile
- `PUT /api/auth/profile-picture` - Update profile picture
- `PUT /api/auth/change-password` - Change password
- `POST /api/auth/logout` - User logout

### Client Routes
- `GET /api/clients/profile` - Get client profile
- `PUT /api/clients/profile` - Update client profile
- `GET /api/clients/sessions` - Get client sessions
- `POST /api/clients/book-session` - Book a session
- `PUT /api/clients/sessions/:id/cancel` - Cancel session
- `GET /api/clients/psychologists` - Get available psychologists

### Psychologist Routes
- `GET /api/psychologists/profile` - Get psychologist profile
- `PUT /api/psychologists/profile` - Update psychologist profile
- `GET /api/psychologists/sessions` - Get psychologist sessions
- `PUT /api/psychologists/sessions/:id` - Update session
- `GET /api/psychologists/availability` - Get availability
- `PUT /api/psychologists/availability` - Update availability
- `GET /api/psychologists/packages` - Get packages
- `POST /api/psychologists/packages` - Create package
- `PUT /api/psychologists/packages/:id` - Update package
- `DELETE /api/psychologists/packages/:id` - Delete package

### Admin Routes
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get user details
- `PUT /api/admin/users/:id/role` - Update user role
- `PUT /api/admin/users/:id/deactivate` - Deactivate user
- `GET /api/admin/stats/platform` - Get platform statistics
- `GET /api/admin/search/users` - Search users

### Superadmin Routes
- `POST /api/superadmin/create-admin` - Create admin user
- `DELETE /api/superadmin/users/:id` - Delete user
- `GET /api/superadmin/analytics/platform` - Get platform analytics
- `POST /api/superadmin/maintenance` - System maintenance
- `GET /api/superadmin/logs/system` - Get system logs

### Session Routes
- `GET /api/sessions/:id` - Get session by ID (public)
- `GET /api/sessions` - Get all sessions (admin)
- `PUT /api/sessions/:id/status` - Update session status
- `PUT /api/sessions/:id/reschedule` - Reschedule session
- `GET /api/sessions/stats/overview` - Get session statistics
- `GET /api/sessions/search/advanced` - Advanced session search

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Different permissions for different user types
- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: API rate limiting to prevent abuse
- **CORS Protection**: Configurable cross-origin resource sharing
- **Helmet Security**: Security headers middleware

## 📊 Database Schema

The backend uses the following main tables:
- `users` - User accounts and authentication
- `clients` - Client information and child details
- `psychologists` - Psychologist profiles and expertise
- `packages` - Therapy packages and pricing
- `availability` - Psychologist availability calendar
- `sessions` - Therapy session bookings and details

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

## 🚀 Deployment

1. **Environment Variables**
   - Set production environment variables
   - Use strong JWT secrets
   - Configure CORS origins

2. **Database**
   - Ensure Supabase production setup
   - Run database migrations if needed

3. **Server**
   ```bash
   npm start
   ```

## 📝 API Documentation

### Request Format
All requests should include:
- `Content-Type: application/json` header
- `Authorization: Bearer <token>` header for protected routes

### Response Format
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error info",
  "statusCode": 400
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Contact the development team

## 🔄 Updates

- **v1.0.0**: Initial release with core functionality
- Role-based authentication system
- Complete CRUD operations for all entities
- Supabase integration
- Comprehensive API endpoints
