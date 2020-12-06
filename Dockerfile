# Select the nodejs 12 LTS version
FROM node:12

# Create app directory
WORKDIR /usr/src/app

# Install server dependencies
COPY package*.json ./
RUN npm ci --only=production

# Install client dependencies
COPY ./client/package*.json ./client/
RUN cd client && npm ci --only=production

# Bundle app source
COPY . .

# Define ENV variables
ENV NODE_ENV=production
ENV USE_HTTP=false
ENV USE_HTTPS=true
ENV PORT_HTTPS=44300
ENV SSL_KEY_PATH=ssl/ssl.key
ENV SSL_CERT_PATH=ssl/ssl.cert

# Expose app default port
EXPOSE 44300

# Start the application
CMD ["node", "app.js"]
