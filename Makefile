# Music Room — development commands
# Usage: make help

COMPOSE ?= docker compose
-include backend/.env
export

.DEFAULT_GOAL := help

.PHONY: help setup env install tunnel eas-setup build-android db-setup db-up db-down db-init db-test \
        back front start test test-back test-integration test-front \
        clean reset bench-seed bench-sockets bench-rest

help:
	@echo "Music Room — make targets"
	@echo ""
	@echo "  setup       full first-time setup (install + env + db-up + db-init)"
	@echo "  start       one-shot: db-up + schema + back & front in new tabs"
	@echo "  reset       wipe everything and re-run setup"
	@echo "  clean       stop containers, prune images, remove node_modules and generated .env"
	@echo ""
	@echo "  env         regenerate backend/.env and frontend/.env from the root .env"
	@echo "  eas-setup   configure EAS Build for the frontend (creates eas.json)"
	@echo "  build-android  build a preview APK via EAS (uses npx eas-cli)"
	@echo "  tunnel        start cloudflared, auto-update frontend/.env and eas.json"
	@echo "  install     install backend + frontend npm dependencies"
	@echo ""
	@echo "  db-setup    start PostgreSQL and (re)create the schema — DELETES ALL DATA"
	@echo "  db-up       start PostgreSQL only"
	@echo "  db-down     stop PostgreSQL"
	@echo "  db-init     recreate the schema only"
	@echo "  db-test     create the test database (musicroom_test)"
	@echo ""
	@echo "  back        start the API + WebSockets (run in its own terminal)"
	@echo "  front       start Expo (run in its own terminal)"
	@echo ""
	@echo "  test        unit tests backend + frontend"
	@echo "  test-integration  API + sockets tests against TEST_DATABASE_URL"
	@echo "  bench-seed / bench-sockets / bench-rest  ramp-up tests (backend/bench/README.md)"

setup: install env db-setup
	@echo ""
	@echo "✅ Setup complete. Run 'make start' to launch everything."

reset: clean setup

clean:
	-@cd backend && $(COMPOSE) down -v --remove-orphans 2>/dev/null || true
	-@docker system prune -af --volumes 2>/dev/null || true
	-@rm -rf backend/node_modules frontend/node_modules
	-@rm -f backend/.env frontend/.env
	-@rm -rf frontend/.expo frontend/dist frontend/web-build
	@echo "✅ Clean complete. Root .env was kept."

install: back-install front-install

back-install:
	cd backend && npm install

front-install:
	cd frontend && npm install

env:
	@bash scripts/setup-env.sh

eas-setup:
	cd frontend && npx eas build:configure

build-android:
	@bash scripts/build-android.sh

tunnel:
	@bash scripts/tunnel.sh

db-setup: db-up db-init

db-up:
	cd backend && $(COMPOSE) up -d db

db-down:
	cd backend && $(COMPOSE) down

db-init:
	@echo "→ Waiting for PostgreSQL..."
	@for i in $$(seq 1 30); do \
		status=$$(docker inspect -f '{{.State.Health.Status}}' music_room_db 2>/dev/null || echo unknown); \
		if [ "$$status" = "healthy" ]; then echo "   PostgreSQL is ready."; break; fi; \
		sleep 1; \
	done
	cd backend && npm run init-db

db-test:
	$(COMPOSE) -f backend/docker-compose.yml exec db psql -U "$(POSTGRES_USER)" -d "$(POSTGRES_DB)" -c "CREATE DATABASE musicroom_test" || true

back:
	cd backend && npm start

front:
	cd frontend && npx expo start

start:
	@bash scripts/start.sh

test: test-back test-front

test-back:
	cd backend && npm test

test-integration:
	cd backend && npm run test:integration

test-front:
	cd frontend && npm run typecheck && npm test

bench-seed:
	cd backend && npm run bench:seed -- 300

bench-sockets:
	cd backend && CLIENTS=200 DURATION=60 npm run bench:sockets

bench-rest:
	cd backend && ./bench/rest-ab.sh
