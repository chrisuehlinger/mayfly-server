FROM node:14-buster-slim

# Create app directory
WORKDIR /usr/src/show-service

# Copy over package lists
COPY package*.json ./

# Install dependencies needed for production
RUN npm install --production=true

COPY . .

EXPOSE 1935
EXPOSE 9000
EXPOSE 9001
EXPOSE 5000
EXPOSE 80
EXPOSE 443
CMD [ "npm", "start" ]