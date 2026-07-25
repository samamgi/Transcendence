SHELL := /bin/bash

ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
BACKEND_DIR := $(ROOT_DIR)backend
FRONTEND_DIR := $(ROOT_DIR)frontend

COMPOSE := podman-compose
CONTAINER_ENGINE := podman
DATABASE_CONTAINER := transcendence-database

.PHONY: \
	all setup install \
	dev dev-backend dev-frontend \
	build backend-build frontend-build \
	lint frontend-lint \
	check \
	db-up db-down db-restart db-status db-logs db-wait \
	prisma prisma-generate prisma-migrate prisma-status \
	socket-test health kill-backend \
	clean fclean re

all: dev


# ─────────────────────────────────────────────────────────────
# Installation
# ─────────────────────────────────────────────────────────────

setup: install db-up db-wait prisma
	@echo
	@echo "Configuration terminée."
	@echo "Démarre tout le projet avec : make dev"

install: \
	$(BACKEND_DIR)/node_modules \
	$(FRONTEND_DIR)/node_modules

$(BACKEND_DIR)/node_modules: \
	$(BACKEND_DIR)/package.json \
	$(BACKEND_DIR)/package-lock.json
	@echo "Installation des dépendances du backend..."
	@cd "$(BACKEND_DIR)" && npm ci

$(FRONTEND_DIR)/node_modules: \
	$(FRONTEND_DIR)/package.json \
	$(FRONTEND_DIR)/package-lock.json
	@echo "Installation des dépendances du frontend..."
	@cd "$(FRONTEND_DIR)" && npm ci


# ─────────────────────────────────────────────────────────────
# Base de données
# ─────────────────────────────────────────────────────────────

db-up:
	@echo "Démarrage des conteneurs..."
	@cd "$(ROOT_DIR)" && $(COMPOSE) up -d

db-down:
	@echo "Arrêt des conteneurs..."
	@cd "$(ROOT_DIR)" && $(COMPOSE) down

db-restart:
	@echo "Redémarrage des conteneurs..."
	@cd "$(ROOT_DIR)" && $(COMPOSE) restart

db-status:
	@cd "$(ROOT_DIR)" && $(COMPOSE) ps

db-logs:
	@cd "$(ROOT_DIR)" && $(COMPOSE) logs -f

db-wait:
	@echo "Attente de PostgreSQL..."
	@for attempt in $$(seq 1 30); do \
		status=$$($(CONTAINER_ENGINE) inspect \
			--format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' \
			"$(DATABASE_CONTAINER)" 2>/dev/null || true); \
		if [ "$$status" = "healthy" ]; then \
			echo "PostgreSQL est prêt."; \
			exit 0; \
		fi; \
		echo "Tentative $$attempt/30... état : $${status:-introuvable}"; \
		sleep 1; \
	done; \
	echo "Erreur : PostgreSQL n'est pas devenu disponible."; \
	$(CONTAINER_ENGINE) logs \
		--tail 30 \
		"$(DATABASE_CONTAINER)" 2>/dev/null || true; \
	exit 1


# ─────────────────────────────────────────────────────────────
# Prisma
# ─────────────────────────────────────────────────────────────

prisma: prisma-generate prisma-migrate

prisma-generate: install
	@echo "Génération du client Prisma..."
	@cd "$(BACKEND_DIR)" && npx prisma generate

prisma-migrate: install
	@echo "Application des migrations..."
	@cd "$(BACKEND_DIR)" && npx prisma migrate deploy

prisma-status: install
	@cd "$(BACKEND_DIR)" && npx prisma migrate status


# ─────────────────────────────────────────────────────────────
# Développement
# ─────────────────────────────────────────────────────────────

dev: setup
	@echo
	@echo "Backend  : http://localhost:3000"
	@echo "Frontend : http://localhost:5173"
	@echo
	@set -e; \
	backend_pid=""; \
	frontend_pid=""; \
	cleanup() { \
		kill "$$backend_pid" "$$frontend_pid" \
			2>/dev/null || true; \
		wait "$$backend_pid" "$$frontend_pid" \
			2>/dev/null || true; \
	}; \
	trap cleanup EXIT INT TERM; \
	(cd "$(BACKEND_DIR)" && npm run dev) & \
	backend_pid=$$!; \
	(cd "$(FRONTEND_DIR)" && npm run dev -- --host 0.0.0.0) & \
	frontend_pid=$$!; \
	wait "$$backend_pid" "$$frontend_pid"

dev-backend: db-up db-wait prisma
	@cd "$(BACKEND_DIR)" && npm run dev

dev-frontend: install
	@cd "$(FRONTEND_DIR)" && npm run dev -- --host 0.0.0.0


# ─────────────────────────────────────────────────────────────
# Compilation et lint
# ─────────────────────────────────────────────────────────────

build: backend-build frontend-build

backend-build: install
	@echo "Compilation du backend..."
	@cd "$(BACKEND_DIR)" && npm run build

frontend-build: install
	@echo "Compilation du frontend..."
	@cd "$(FRONTEND_DIR)" && npm run build

lint: frontend-lint

frontend-lint: install
	@echo "Vérification ESLint du frontend..."
	@cd "$(FRONTEND_DIR)" && npm run lint


# ─────────────────────────────────────────────────────────────
# Tests et vérifications
# ─────────────────────────────────────────────────────────────

health:
	@curl \
		--fail \
		--silent \
		--show-error \
		http://localhost:3000/health
	@echo

socket-test: install db-wait
	@cd "$(BACKEND_DIR)" && \
		npx tsx scripts/socket-test.ts

check: db-up db-wait prisma build lint
	@echo
	@echo "=== Vérification complète du projet ==="
	@echo
	@set -e; \
	backend_started=0; \
	backend_pid=""; \
	cleanup() { \
		if [ "$$backend_started" -eq 1 ]; then \
			kill "$$backend_pid" 2>/dev/null || true; \
			wait "$$backend_pid" 2>/dev/null || true; \
		fi; \
	}; \
	trap cleanup EXIT INT TERM; \
	if ! curl --fail --silent \
		http://localhost:3000/health >/dev/null 2>&1; then \
		echo "Démarrage temporaire du backend..."; \
		(cd "$(BACKEND_DIR)" && npm run start) \
			> /tmp/transcendence-backend-check.log 2>&1 & \
		backend_pid=$$!; \
		backend_started=1; \
		for attempt in $$(seq 1 30); do \
			if curl --fail --silent \
				http://localhost:3000/health \
				>/dev/null 2>&1; then \
				break; \
			fi; \
			if ! kill -0 "$$backend_pid" \
				2>/dev/null; then \
				echo "Le backend s'est arrêté."; \
				cat /tmp/transcendence-backend-check.log; \
				exit 1; \
			fi; \
			if [ "$$attempt" -eq 30 ]; then \
				echo "Le backend ne répond pas."; \
				cat /tmp/transcendence-backend-check.log; \
				exit 1; \
			fi; \
			sleep 1; \
		done; \
	fi; \
	echo "Conteneurs"; \
	$(MAKE) --no-print-directory db-status; \
	echo; \
	echo "Backend"; \
	$(MAKE) --no-print-directory health; \
	echo; \
	echo "Prisma"; \
	$(MAKE) --no-print-directory prisma-status; \
	echo; \
	echo "Socket.IO"; \
	$(MAKE) --no-print-directory socket-test; \
	echo; \
	echo "Toutes les vérifications sont terminées."


# ─────────────────────────────────────────────────────────────
# Nettoyage
# ─────────────────────────────────────────────────────────────

kill-backend:
	@echo "Arrêt du backend local..."
	@fuser -k 3000/tcp 2>/dev/null || true

clean: kill-backend
	@echo "Arrêt des conteneurs..."
	@cd "$(ROOT_DIR)" && $(COMPOSE) down
	@echo "Suppression des fichiers compilés..."
	@rm -rf "$(BACKEND_DIR)/dist"
	@rm -rf "$(FRONTEND_DIR)/dist"

fclean: clean
	@echo "Suppression des dépendances..."
	@rm -rf "$(BACKEND_DIR)/node_modules"
	@rm -rf "$(FRONTEND_DIR)/node_modules"

re: fclean setup dev
