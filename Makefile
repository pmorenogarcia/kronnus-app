# =============================================================================
# Kronnus App — Makefile
# React Native + Expo frontend
# =============================================================================

.DEFAULT_GOAL := help
.PHONY: help install start android ios web tunnel lint typecheck check \
        clean reset reset-project doctor upgrade prebuild prebuild-clean api

API_DIR := ../kronnus-api

# -----------------------------------------------------------------------------
# Help
# -----------------------------------------------------------------------------

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

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
