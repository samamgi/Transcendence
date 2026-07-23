SHELL := /bin/bash

# Chemins absolus pour que le Makefile fonctionne depuis n'importe quel dossier
ROOT_DIR := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))
BACKEND_DIR := $(ROOT_DIR)backend

# Podman est utilisé directement pour éviter les messages d'émulation Docker
COMPOSE := podman-compose
CONTAINER_ENGINE := podman
DATABASE_CONTAINER := transcendence-database

.PHONY: all \
	setup install \
	dev check \
	db-up db-down db-restart db-status db-logs db-wait \
	prisma prisma-generate prisma-migrate prisma-status \
	socket-test health \
	clean fclean re

all: dev


# ─────────────────────────────────────────────────────────────
# Installation
# ─────────────────────────────────────────────────────────────

setup: install db-up db-wait prisma
	@echo
	@echo "Configuration terminée."
	@echo "Tu peux démarrer le backend avec : make dev"

install: $(BACKEND_DIR)/node_modules

$(BACKEND_DIR)/node_modules: $(BACKEND_DIR)/package.json
	@echo "Installation des dépendances du backend..."
	@if [ -f "$(BACKEND_DIR)/package-lock.json" ]; then \
		cd "$(BACKEND_DIR)" && npm ci; \
	else \
		cd "$(BACKEND_DIR)" && npm install; \
	fi


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
	echo "Derniers logs du conteneur :"; \
	$(CONTAINER_ENGINE) logs --tail 30 "$(DATABASE_CONTAINER)" 2>/dev/null || true; \
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
# Backend
# ─────────────────────────────────────────────────────────────

dev: db-up db-wait prisma
	@echo
	@echo "Démarrage du backend..."
	@cd "$(BACKEND_DIR)" && npm run dev

health:
	@curl --fail --silent --show-error http://localhost:3000/health
	@echo

socket-test: install db-wait
	@cd "$(BACKEND_DIR)" && npx tsx scripts/socket-test.ts


# ─────────────────────────────────────────────────────────────
# Vérifications
# ─────────────────────────────────────────────────────────────

check: install
	@echo "=== Vérification de l'environnement ==="
	@echo
	@echo "Conteneurs"
	@$(MAKE) --no-print-directory db-status
	@echo
	@echo "Backend"
	@$(MAKE) --no-print-directory health
	@echo
	@echo "Prisma"
	@$(MAKE) --no-print-directory prisma-status
	@echo
	@echo "Socket.IO"
	@$(MAKE) --no-print-directory socket-test
	@echo
	@echo "Toutes les vérifications sont terminées."


# ─────────────────────────────────────────────────────────────
# Nettoyage
# ─────────────────────────────────────────────────────────────

clean:
	@echo "Arrêt des conteneurs..."
	@cd "$(ROOT_DIR)" && $(COMPOSE) down
	@echo "Suppression des fichiers compilés..."
	@rm -rf "$(BACKEND_DIR)/dist"

fclean: clean
	@echo "Suppression des dépendances du backend..."
	@rm -rf "$(BACKEND_DIR)/node_modules"

re: fclean setup