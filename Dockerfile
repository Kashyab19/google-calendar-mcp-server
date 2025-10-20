FROM node:18-alpine

WORKDIR /app

# Copy files
COPY package*.json ./


RUN npm install

COPY . .


RUN npm run build


EXPOSE 8081

# Start the MCP server
CMD ["node", ".smithery/index.cjs"]
