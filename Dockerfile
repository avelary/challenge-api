FROM node:18-alpine

WORKDIR /app

# Copiar arquivos de configuração primeiro
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma/

# Instalar dependências com legacy-peer-deps
RUN npm install --legacy-peer-deps

# Copiar código fonte
COPY . .

# Gerar Prisma client
RUN npx prisma generate

# Compilar TypeScript
RUN npm run build

# Expor porta
EXPOSE 10000

# Comando para iniciar
CMD ["npm", "start"] 