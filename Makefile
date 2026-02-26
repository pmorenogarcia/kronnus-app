# =============================================================================
# Kronnus App — Makefile
# React Native + Expo frontend
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help install start android ios web tunnel lint typecheck check \
        format pre-commit clean reset reset-project doctor upgrade prebuild prebuild-clean api

API_DIR := ../kronnus-api

# -----------------------------------------------------------------------------
# Help
# -----------------------------------------------------------------------------

help:
	$(info Kronnus App - Available Commands)
	$(info )
	$(info   Dependencies)
	$(info     make install          Install npm dependencies)
	$(info )
	$(info   Development)
	$(info     make start            Start Expo dev server (LAN))
	$(info     make android          Start on Android emulator or device)
	$(info     make ios              Start on iOS simulator or device)
	$(info     make web              Start in browser)
	$(info     make tunnel           Start with tunnel (any network))
	$(info )
	$(info   Code Quality)
	$(info     make lint             Run ESLint)
	$(info     make typecheck        Run TypeScript type check)
	$(info     make check            Run lint + typecheck together)
	$(info     make format           Format all files with Prettier)
	$(info     make pre-commit       Run pre-commit checks on staged files)
	$(info )
	$(info   Maintenance)
	$(info     make clean            Remove node_modules and Expo cache)
	$(info     make reset            Clean install)
	$(info     make doctor           Run Expo Doctor)
	$(info     make upgrade          Upgrade Expo SDK)
	$(info )
	$(info   Native Builds)
	$(info     make prebuild         Generate native android/ and ios/ dirs)
	$(info     make prebuild-clean   Regenerate native dirs from scratch)
	$(info )
	$(info   Companion API)
	$(info     make api              Start the kronnus-api Go backend)
	@:

# -----------------------------------------------------------------------------
# Dependencies
# -----------------------------------------------------------------------------

install: ## Install npm dependencies
	npm install

# -----------------------------------------------------------------------------
# Development
# -----------------------------------------------------------------------------

start: ## Start Expo dev server (Metro bundler, opens menu)
	npx expo start --lan

android: ## Start on Android emulator or connected device
	npx expo start --android

ios: ## Start on iOS simulator or connected device
	npx expo start --ios

web: ## Start on web browser
	npx expo start --web

tunnel: ## Start with tunnel — use for testing on a real device over any network
	npx expo start --tunnel

# -----------------------------------------------------------------------------
# Code Quality
# -----------------------------------------------------------------------------

lint: ## Run ESLint via expo lint
	npx expo lint

typecheck: ## Run TypeScript compiler — type check only, no output
	npx tsc --noEmit

check: lint typecheck ## Run lint + typecheck (full quality gate)

format: ## Format all files with Prettier
	npx prettier --write .

pre-commit: ## Run pre-commit checks on staged files (same as the git hook)
	npx lint-staged

# -----------------------------------------------------------------------------
# Maintenance
# -----------------------------------------------------------------------------

clean: ## Remove node_modules and Expo cache
	rm -rf node_modules .expo

reset: clean install ## Clean install — wipe cache then reinstall dependencies

reset-project: ## Reset to blank Expo template (destructive — removes app scaffolding)
	node ./scripts/reset-project.js

doctor: ## Run Expo Doctor to detect known configuration issues
	npx expo-doctor

upgrade: ## Interactive Expo SDK version upgrade
	npx expo upgrade

# -----------------------------------------------------------------------------
# Native Builds
# -----------------------------------------------------------------------------

prebuild: ## Generate native android/ and ios/ directories from Expo config
	npx expo prebuild

prebuild-clean: ## Regenerate native directories from scratch (--clean flag)
	npx expo prebuild --clean

# -----------------------------------------------------------------------------
# Companion API  (requires kronnus-api to have its own Makefile with a `run` target)
# -----------------------------------------------------------------------------

api: ## Start the kronnus-api Go backend from the sibling repo
	$(MAKE) -C $(API_DIR) run
