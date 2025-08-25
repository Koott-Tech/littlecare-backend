# 🚀 Quick Start Guide

Get your Kuttikal backend running in 5 minutes!

## ⚡ Quick Setup

### 1. Environment Setup
```bash
# Copy environment template
cp env.example .env

# Edit .env with your Supabase credentials
nano .env
```

**Required in .env:**
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
JWT_SECRET=your-super-secret-jwt-key-here
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Test Connection
```bash
node test-server.js
```

### 4. Start Development Server
```bash
npm run dev
```

## 🧪 Test Your API

### Health Check
```bash
curl http://localhost:5000/health
```

### Register a Client
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "role": "client",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+1234567890",
    "child_name": "Jane",
    "child_age": 8
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

## 🔑 Sample Data

### Create a Psychologist
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "dr.sarah@example.com",
    "password": "password123",
    "role": "psychologist",
    "first_name": "Sarah",
    "last_name": "Johnson",
    "ug_college": "University of California",
    "pg_college": "Stanford University",
    "designation": "fulltime",
    "area_of_expertise": ["Child Psychology", "ADHD", "Anxiety"],
    "description": "Licensed child psychologist with 15+ years experience"
  }'
```

## 📱 API Testing Tools

- **Postman**: Import the collection (when available)
- **Insomnia**: REST client for testing
- **cURL**: Command line testing
- **Thunder Client**: VS Code extension

## 🚨 Common Issues

### 1. Supabase Connection Failed
- Check your `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Ensure your Supabase project is active
- Verify the database tables exist

### 2. JWT Secret Missing
- Set a strong `JWT_SECRET` in your `.env` file
- Restart the server after changing environment variables

### 3. Port Already in Use
- Change `PORT` in `.env` file
- Or kill the process using port 5000

## 📚 Next Steps

1. **Test all endpoints** with different user roles
2. **Set up your frontend** to connect to the backend
3. **Configure CORS** for your frontend domain
4. **Add file upload** functionality for profile pictures
5. **Implement email notifications** for session bookings

## 🆘 Need Help?

- Check the main README.md for detailed documentation
- Review the API endpoints in the routes files
- Test with the provided sample data
- Check console logs for detailed error messages

---

**Happy Coding! 🎉**
