.PHONY: start stop build rebuild

build:
	docker-compose build signal-bot

rebuild:
	docker-compose build --no-cache signal-bot

start:
	@echo "Starting databases..."
	docker-compose up -d postgres redis
	@echo "Waiting for databases to be ready..."
	sleep 30
	@echo "Starting application..."
	docker-compose up -d signal-bot
	@echo "Starting monitoring..."
	docker-compose --profile monitoring up -d
	@echo "All services started!"

restart-signal-bot:
	docker-compose restart signal-bot

stop:
	docker-compose down

shell-signal-bot:
	docker-compose exec signal-bot sh

db-generate:
	docker-compose exec signal-bot npx prisma generate

db-migrate:
	docker-compose exec signal-bot npx prisma migrate dev

db-seed:
	docker-compose exec signal-bot npm run db:seed

db-reset:
	docker-compose exec signal-bot npm run db:reset

db-setup: db-generate db-migrate db-seed
	@echo "Database setup completed!"
