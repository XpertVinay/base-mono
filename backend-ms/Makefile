.PHONY: help up down restart logs build ps clean test health migrate

help:
	@echo "Available commands:"
	@echo "  make up          - Start all microservices, API gateway, Postgres, and RabbitMQ"
	@echo "  make down        - Stop all containers"
	@echo "  make build       - Build all Docker images"
	@echo "  make restart     - Restart all containers"
	@echo "  make logs        - Tail container logs"
	@echo "  make ps          - Show running service containers"
	@echo "  make health      - Query API Gateway health endpoint"
	@echo "  make clean       - Remove containers, networks, and persistent volumes"

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

restart:
	docker compose restart

logs:
	docker compose logs -f

ps:
	docker compose ps

health:
	@echo "Checking API Gateway and microservices health..."
	@curl -s http://localhost:4000/health/detailed | jq . || curl -s http://localhost:4000/health/detailed

clean:
	docker compose down -v --remove-orphans
