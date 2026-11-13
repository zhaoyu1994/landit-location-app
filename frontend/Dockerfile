FROM node:22-alpine

WORKDIR /app

# 依存パッケージをインストールする
COPY package*.json ./
RUN npm ci

# アプリケーションのソースコードをコピーする
COPY . .

EXPOSE 3000

# 開発サーバーを起動する
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]
