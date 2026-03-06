# Book Community App

A full-stack book community application built with React, Express, and MongoDB.

## Local Launch Guide

Follow these steps to run the application on your local machine.

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/) (comes with Node.js)
- A [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) account (or a local MongoDB instance)

### Installation

1. **Clone the repository** (if you haven't already):
   ```bash
   git clone <repository-url>
   cd <repository-directory>
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   - Create a `.env` file in the root directory.
   - Copy the contents of `.env.example` into `.env`.
   - Update the variables in `.env` with your actual credentials:
     ```env
     MONGODB_URI="your_mongodb_connection_string"
     GEMINI_API_KEY="your_gemini_api_key"
     PORT=3000
     NODE_ENV=development
     ```

4. **MongoDB Setup**:
   - Ensure your MongoDB Atlas cluster allows connections from your local IP address (Network Access -> Add IP Address -> Add Current IP Address).

### Running the App

1. **Start the development server**:
   ```bash
   npm run dev
   ```
   This command starts the Express server (which also handles Vite middleware for the frontend).

2. **Open the app**:
   Navigate to `http://localhost:3000` in your web browser.

### Building for Production

To create a production build:

1. **Build the frontend**:
   ```bash
   npm run build
   ```

2. **Start the production server**:
   ```bash
   NODE_ENV=production npm start
   ```

## Project Structure

- `server.ts`: Express backend and Vite middleware configuration.
- `src/`: React frontend source code.
- `api/`: Vercel serverless function entry point.
- `vercel.json`: Deployment configuration for Vercel.
