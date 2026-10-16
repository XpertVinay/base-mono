# ==============================================================================
# INFRASTRUCTURE PLATFORM: DEVELOPER AUTOMATION MAKEFILE
# Purpose:
#   Provides consistent, fail-safe commands for local development, provisioning,
#   configuration management, and workload deployment.
# Architectural Rules:
#   - Defaults to ENV=dev to prevent accidental modifications to production.
#   - Production actions require explicit confirmation or ENV=prod parameter.
# ==============================================================================

ENV ?= local
TF_DIR = terraform/environments/$(ENV)

.PHONY: help init fmt validate lint plan provision inventory configure deploy-docker deploy-k8s test health-check destroy

help:
	@echo "======================================================================"
	@echo " Provider-Agnostic Infrastructure as Code Platform"
	@echo "======================================================================"
	@echo " Usage: make <target> [ENV=dev|staging|prod]"
	@echo ""
	@echo " Commands:"
	@echo "   make init          - Initialize Terraform modules and dependencies"
	@echo "   make fmt           - Auto-format Terraform, Ansible, and Shell scripts"
	@echo "   make validate      - Validate syntax and test server count bounds (1-5)"
	@echo "   make lint          - Run tflint and ansible-lint"
	@echo "   make plan          - Generate execution plan for target environment"
	@echo "   make provision     - Provision infrastructure for target environment"
	@echo "   make inventory     - Extract Terraform outputs into Ansible inventory"
	@echo "   make configure     - Run Ansible playbooks to harden and configure hosts"
	@echo "   make deploy-docker - Deploy containerized application via Docker Compose"
	@echo "   make deploy-k8s    - Deploy application via Kubernetes Kustomize overlay"
	@echo "   make test          - Run automated tests and validation suite"
	@echo "   make health-check  - Verify load balancer and application health endpoint"
	@echo "   make destroy       - Destroy infrastructure for target environment"
	@echo "======================================================================"

init:
	@echo "Initializing environment: $(ENV)"
	./scripts/bootstrap.sh
	cd $(TF_DIR) && terraform init

fmt:
	@echo "Formatting Terraform files..."
	terraform fmt -recursive terraform/
	@echo "Formatting Shell scripts..."
	@which shfmt >/dev/null 2>&1 && shfmt -w scripts/*.sh || echo "shfmt not installed, skipping shell format."

validate:
	@echo "Running validation suite..."
	./scripts/validate.sh

lint:
	@echo "Running linters..."
	@which tflint >/dev/null 2>&1 && (cd $(TF_DIR) && tflint) || echo "tflint not installed, skipping."
	@which ansible-lint >/dev/null 2>&1 && (cd ansible && ansible-lint) || echo "ansible-lint not installed, skipping."

plan:
	@echo "Planning infrastructure changes for environment: $(ENV)"
	cd $(TF_DIR) && terraform plan

provision:
	@echo "Applying infrastructure changes for environment: $(ENV)"
	cd $(TF_DIR) && terraform apply -auto-approve

inventory:
	@echo "Generating Ansible inventory for environment: $(ENV)"
	./scripts/generate-inventory.sh $(ENV)

configure: inventory
	@echo "Running Ansible host configuration for environment: $(ENV)"
	cd ansible && ansible-playbook -i inventories/$(ENV)/hosts.yaml playbooks/site.yml

deploy-docker:
	@echo "Deploying application via Docker Compose to $(ENV)"
	cd ansible && ansible-playbook -i inventories/$(ENV)/hosts.yaml playbooks/deploy-app.yml

deploy-k8s:
	@echo "Deploying application to Kubernetes overlay: $(ENV)"
	kubectl apply -k kubernetes/overlays/$(ENV)

test: validate
	@echo "Running automated verification tests..."
	./scripts/validate.sh

health-check:
	@echo "Performing health verification..."
	./scripts/health-check.sh $(ENV)

destroy:
	@echo "WARNING: Destroying infrastructure in environment: $(ENV)"
	@if [ "$(ENV)" = "prod" ]; then \
		echo "CRITICAL: You are about to destroy PRODUCTION infrastructure."; \
		read -p "Type 'destroy-production' to confirm: " confirm && [ "$$confirm" = "destroy-production" ]; \
	fi
	cd $(TF_DIR) && terraform destroy

# ------------------------------------------------------------------------------
# LOCAL DOCKER WORKSTATION TESTING TARGETS (OFFLINE / NO CLOUD NEEDED)
# ------------------------------------------------------------------------------
local-up:
	@echo "Starting application container locally via Docker Compose..."
	docker compose -f containers/compose/docker-compose.standalone.yml up -d
	@echo "Application started. Listening on http://localhost:8888"

local-down:
	@echo "Stopping local Docker Compose containers..."
	docker compose -f containers/compose/docker-compose.standalone.yml down

local-test: local-up
	@echo "Verifying local container status..."
	docker compose -f containers/compose/docker-compose.standalone.yml ps

