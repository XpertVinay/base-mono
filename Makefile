# ==============================================================================
# ROOT AUTOMATION MAKEFILE
# Purpose:
#   Delegates platform infrastructure and operational lifecycle targets to infra/
#   enabling seamless execution from the repository root.
# ==============================================================================

ENV ?= dev

.PHONY: help init fmt validate lint plan provision inventory configure deploy-docker deploy-k8s test health-check destroy local-up local-down local-test local-k8s-deploy local-k8s-status local-k8s-delete

help:
	@$(MAKE) -C infra help

init:
	@$(MAKE) -C infra init ENV=$(ENV)

fmt:
	@$(MAKE) -C infra fmt

validate:
	@$(MAKE) -C infra validate

lint:
	@$(MAKE) -C infra lint

plan:
	@$(MAKE) -C infra plan ENV=$(ENV)

provision:
	@$(MAKE) -C infra provision ENV=$(ENV)

inventory:
	@$(MAKE) -C infra inventory ENV=$(ENV)

configure:
	@$(MAKE) -C infra configure ENV=$(ENV)

deploy-docker:
	@$(MAKE) -C infra deploy-docker ENV=$(ENV)

deploy-k8s:
	@$(MAKE) -C infra deploy-k8s ENV=$(ENV)

test:
	@$(MAKE) -C infra test

health-check:
	@$(MAKE) -C infra health-check ENV=$(ENV)

destroy:
	@$(MAKE) -C infra destroy ENV=$(ENV)

# ------------------------------------------------------------------------------
# LOCAL WORKSTATION TESTING TARGETS (ZERO CLOUD CREDENTIALS REQUIRED)
# ------------------------------------------------------------------------------
local-up:
	@$(MAKE) -C infra local-up

local-down:
	@$(MAKE) -C infra local-down

local-test:
	@$(MAKE) -C infra local-test

local-k8s-deploy:
	@$(MAKE) -C infra local-k8s-deploy

local-k8s-status:
	@$(MAKE) -C infra local-k8s-status

local-k8s-delete:
	@$(MAKE) -C infra local-k8s-delete
