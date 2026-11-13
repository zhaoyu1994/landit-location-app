# Location Explorer

## 1. 概要

Location Explorer は、地図上で周辺の地点情報を検索・表示する Web アプリケーションです。

地図の中心座標と検索半径を指定することで、指定範囲内の地点を検索できます。また、地図の移動に合わせて中心地点の住所を取得し、周辺情報を直感的に確認できます。

## 2. 使用技術

| 分類 | 技術 |
|---|---|
| フロントエンド | Next.js 16 / React 19 / TypeScript |
| UI | Tailwind CSS |
| 地図表示 | Leaflet / React Leaflet |
| バックエンド | NestJS |
| ORM | TypeORM |
| データベース | PostgreSQL 16 |
| 外部 API | OpenStreetMap Nominatim |
| 開発環境 | Docker / Docker Compose |

## 3. 環境構築

### 前提条件

- Docker Desktop
- Docker Compose
- Git

Node.js や PostgreSQL をローカル環境に直接インストールする必要はありません。

### リポジトリの取得

```bash
git clone <repository-url>
cd landit-location-app
```

### 環境変数の設定

`.env.example` を参考に、必要な環境変数を設定してください。

```bash
cp .env.example .env
```

バックエンド用の環境変数についても、`backend/.env` を作成してください。

※ 実際の環境変数名・設定方法は、リポジトリ内の `.env.example` および Docker Compose の設定に従ってください。

## 4. 実行手順

プロジェクトのルートディレクトリで、以下を実行します。

```bash
docker compose up -d --build
```

以下の3つのサービスが起動します。

| サービス | URL / ポート |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:3001 |
| PostgreSQL | localhost:5432 |

コンテナの起動状態を確認します。

```bash
docker compose ps
```

ログを確認する場合：

```bash
docker compose logs -f
```

アプリケーションを停止する場合：

```bash
docker compose down
```

データベースのデータを含めて初期化する場合：

```bash
docker compose down -v
```

※ `-v` を指定すると、PostgreSQL の保存データも削除されます。

## 5. 主な機能

- 地図上への地点マーカー表示
- 地点一覧と地図マーカーの連動
- マーカー選択時の地図移動
- 地図の中心座標を基準とした周辺地点検索
- 検索半径の変更
- 地図移動終了時の中心地点住所の取得
- ローディング・エラー・検索結果ゼロ件の表示
- CSV データのデータベースへの初期投入

## 6. 使用した主要ライブラリと選定理由

### Next.js / React

React によるコンポーネントベースの UI 開発が可能であり、Next.js を採用することでルーティングや開発環境の構築を効率化しました。

### Tailwind CSS

ユーティリティクラスを使用することで、画面レイアウトや状態に応じた UI の実装を簡潔に行えるため採用しました。

### Leaflet / React Leaflet

軽量で導入しやすく、マーカー・ポップアップ・地図イベントなど、今回必要な地図機能を実装できるため採用しました。

### NestJS

モジュール単位で責務を分離でき、Controller と Service を明確に分けた保守性の高い API 構成を実現できるため採用しました。

### TypeORM

Entity を利用したデータ管理が可能であり、NestJS との統合も容易なため採用しました。

### PostgreSQL

地点情報を永続化するために採用しました。

### OpenStreetMap Nominatim

地図の中心座標から住所を取得する Reverse Geocoding に利用しました。

## 7. 実装時に工夫した点・技術的な判断

### 7.1 周辺地点の検索処理

緯度・経度と検索半径を API に渡し、バックエンド側で Haversine Formula を利用して2地点間の距離を計算しています。

検索範囲内の地点だけを抽出し、距離の近い順に返却します。

今回のデータ件数は約200件のため、PostGIS などの追加拡張を導入せず、アプリケーション側で距離計算を行う構成にしました。

### 7.2 CSV データの初期投入

NestJS の初期化処理で CSV ファイルを読み込み、データベースが空の場合に地点情報を登録する仕組みを実装しました。

すでにデータが存在する場合は再投入をスキップすることで、コンテナ再起動時の重複登録を防止しています。

### 7.3 Reverse Geocoding のリクエスト制御

地図の移動終了イベント（`moveend`）を利用し、移動中ではなく移動終了後に住所を取得するようにしました。

また、以下の工夫を行っています。

- デバウンスによる連続リクエストの抑制
- リクエスト間隔の制御
- 取得済み住所のキャッシュ
- 緯度・経度を小数点以下4桁に丸め、微小な座標変化による不要なリクエストを抑制
- 古いリクエスト結果が新しい表示を上書きしないための制御

### 7.4 UI の状態管理

地点情報の取得中、取得失敗時、検索結果が0件の場合に、それぞれ適切なメッセージを表示するようにしました。

また、地点一覧と地図上のマーカーを連動させ、選択した地点が視覚的に分かるようにしています。

### 7.5 Docker Compose による環境統一

Frontend、Backend、Database を Docker Compose で管理し、1つのコマンドでアプリケーション全体を起動できる構成にしました。

PostgreSQL の Health Check を設定し、データベースの起動完了後にバックエンドを起動するようにしています。

## 8. 簡略化した箇所・今後の改善点

### 8.1 地点検索のパフォーマンス

現状はバックエンドで地点情報を取得した後、Haversine Formula によって距離を計算しています。

データ件数が増加した場合は、PostGIS の `ST_DWithin` や GiST インデックスを利用し、データベース側で空間検索を行う構成に改善できます。

### 8.2 Reverse Geocoding API

現在は OpenStreetMap Nominatim の公開 API を利用しています。

本番環境では利用ポリシーやリクエスト制限を考慮し、専用の Geocoding サービスやキャッシュサーバーの導入を検討します。

### 8.3 テスト

今後は以下のテストを追加し、品質を向上させたいと考えています。

- API の単体テスト
- 距離計算ロジックのテスト
- フロントエンドのコンポーネントテスト
- E2E テスト

## 9. データソース・ライセンス

地図タイルおよび地理情報には OpenStreetMap を利用しています。

© OpenStreetMap contributors

Nominatim の利用にあたっては、OpenStreetMap の利用ポリシーに従っています。