# Deployment Guide

## Local Development

```bash
npm install
npm start
```

Open `http://localhost:3000` in your browser.

## Production Deployment Options

### 1. Heroku

```bash
# Install Heroku CLI
# Login to Heroku
heroku login

# Create app
heroku create your-app-name

# Deploy
git init
git add .
git commit -m "Initial commit"
git push heroku main

# Open app
heroku open
```

Add a `Procfile`:
```
web: node server/server.js
```

### 2. Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Or connect GitHub repo at vercel.com
```

Add `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "server/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "server/server.js"
    }
  ]
}
```

### 3. DigitalOcean / AWS / Azure

1. Create a VM instance
2. Install Node.js
3. Clone repository
4. Run `npm install`
5. Use PM2 for process management:

```bash
npm install -g pm2
pm2 start server/server.js
pm2 startup
pm2 save
```

### 4. Docker

Create `Dockerfile`:
```dockerfile
FROM node:14
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["node", "server/server.js"]
```

Build and run:
```bash
docker build -t collaborative-canvas .
docker run -p 3000:3000 collaborative-canvas
```

## Environment Variables

```bash
PORT=3000  # Server port (default: 3000)
```

## SSL/HTTPS

For production, use a reverse proxy like Nginx:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Then use Let's Encrypt for SSL:
```bash
certbot --nginx -d your-domain.com
```

## Performance Tips

1. Use a CDN for static assets
2. Enable gzip compression
3. Use Redis for scaling (Socket.io adapter)
4. Set up monitoring (PM2 or external service)
5. Configure proper CORS settings for production

## Monitoring

Use PM2 monitoring:
```bash
pm2 monit
```

Or use external services:
- New Relic
- DataDog
- Sentry for error tracking
