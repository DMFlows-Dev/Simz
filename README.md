# Node.js + Express Backend Server

## Features
- Uses environment variables for configuration (dotenv)
- Connects to MySQL database (mysql2)
- Four GET APIs:
  - `/api/users` — List all users
  - `/api/user/:id` — Get user by ID
  - `/api/products` — List all products
  - `/api/product/:id` — Get product by ID
- Error handling for database and API errors
- Project structure with separate folders for routes, controllers, and config

## Setup
1. Copy `.env.sample` to `.env` and fill in your database credentials.
2. Install dependencies:
   ```sh
   npm install express mysql2 dotenv
   ```
3. Start the server:
   ```sh
   node server.js
   ```

## Project Structure
```
config/
  db.js
controllers/
  userController.js
  productController.js
routes/
  userRoutes.js
  productRoutes.js
.env.sample
server.js
README.md
```

## Environment Variables
See `.env.sample` for required variables.

## Error Handling
All database and API errors return JSON with error details.
