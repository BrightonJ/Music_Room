# Music Room — development commands
# Usage: make install, make db-up, make db-init, make back, make front, make test

COMPOSE ?= docker compose
-include backend/.env
export

.PHONY: help install back-install front-install env db-up db-down db-init db-test back front test test-back test-integration test-front bench-seed bench-sockets bench-rest

help:
	@echo "make install          install backend + frontend dependencies"
	@echo "make env              create backend/.env and frontend/.env from the examples"
	@echo "make db-up            start PostgreSQL ($(COMPOSE))"
	@echo "make db-init          (re)create the schema - DELETES ALL DATA"
	@echo "make db-test          create the test database (musicroom_test)"
	@echo "make back             start the API + WebSockets"
	@echo "make front            start Expo (scan the QR code with iOS / Android)"
	@echo "make test             unit tests backend + frontend"
	@echo "make test-integration API + sockets tests against TEST_DATABASE_URL"
	@echo "make bench-seed / bench-sockets / bench-rest   ramp-up tests (see backend/bench/README.md)"

install: back-install front-install

back-install:
	cd backend && npm install

front-install:
	cd frontend && npm install

env:
	@test -f backend/.env || (cp backend/.env.example backend/.env && echo "backend/.env created: fill it in")
	@test -f frontend/.env || (cp frontend/.env.example frontend/.env && echo "frontend/.env created")

db-up:
	cd backend && $(COMPOSE) up -d db

db-down:
	cd backend && $(COMPOSE) down

db-init:
	cd backend && npm run init-db

db-test:
	$(COMPOSE) -f backend/docker-compose.yml exec db psql -U "$(POSTGRES_USER)" -d "$(POSTGRES_DB)" -c "CREATE DATABASE musicroom_test" || true

back:
	cd backend && npm start

front:
	cd frontend && npx expo start

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
