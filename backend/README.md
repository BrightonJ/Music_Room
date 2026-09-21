# Music Room - Back-end

## Setup

1. Create your local environment file (it is ignored by git):

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and replace the placeholder values (`USER`, `PASSWORD`, `CHANGE_ME`).
   `POSTGRES_USER`, `POSTGRES_PASSWORD` and `POSTGRES_DB` must match `DATABASE_URL`.

3. Start the database, install dependencies, create the tables and run the server:

   ```bash
   docker compose up -d
   npm install
   node init.js
   node server.js
   ```

`docker compose up` fails with an explicit message if `.env` is missing or incomplete.

## Upgrading an existing checkout

Earlier versions of `docker-compose.yml` hardcoded the credentials `admin` / `rootpassword`.
The `pgdata` volume keeps the credentials it was created with, so changing `.env` alone does not
update them and the API will fail to connect. Either:

- keep the old credentials in your `.env` (`POSTGRES_USER=admin`, `POSTGRES_PASSWORD=rootpassword`, `POSTGRES_DB=musicroom`), or
- reset the volume (**deletes all local data**; `node init.js` recreates the tables):

  ```bash
  docker compose down -v
  docker compose up -d
  node init.js
  ```
