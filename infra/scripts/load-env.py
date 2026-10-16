#!/usr/bin/env python3
"""
Infrastructure Platform: Dynamic Environment & Secret Manager Loader
Designated Folder: infra/environments/<environment>/

Resolves environment variables with 3-tier precedence:
  1. CI/CD Secrets & Process Environment (Highest priority)
  2. Cloud Provider Secret Managers (AWS Secrets Manager, AWS SSM, GCP Secret Manager, Azure Key Vault, HashiCorp Vault)
  3. .env files (Completely optional, loaded from designated folder or root)
  4. Environment specification defaults (secrets.spec.yaml)
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None


def find_infra_root() -> Path:
    script_dir = Path(__file__).resolve().parent
    return script_dir.parent


def parse_dotenv_file(filepath: Path) -> dict:
    """Parses a standard .env file into a dictionary."""
    env_vars = {}
    if not filepath.is_file():
        return env_vars

    with open(filepath, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip()
                # Remove surrounding quotes
                if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                    val = val[1:-1]
                env_vars[key] = val
    return env_vars


def query_cloud_secret(provider: str, secret_id: str, key: str = None) -> str:
    """Dynamically queries a cloud provider secret manager for a secret value."""
    # Allow test mocks via MOCK_SECRET_<ENV_VAR> or MOCK_SECRET_STORE
    mock_store = os.environ.get("MOCK_SECRET_STORE")
    if mock_store:
        try:
            store = json.loads(mock_store)
            if secret_id in store:
                val = store[secret_id]
                if isinstance(val, dict) and key:
                    return str(val.get(key, ""))
                return str(val)
        except Exception:
            pass

    cmd = []
    if provider == "aws_secrets_manager":
        cmd = ["aws", "secretsmanager", "get-secret-value", "--secret-id", secret_id, "--query", "SecretString", "--output", "text"]
    elif provider == "aws_ssm":
        cmd = ["aws", "ssm", "get-parameter", "--name", secret_id, "--with-decryption", "--query", "Parameter.Value", "--output", "text"]
    elif provider == "gcp_secret_manager":
        cmd = ["gcloud", "secrets", "versions", "access", "latest", f"--secret={secret_id}"]
    elif provider == "azure_key_vault":
        # secret_id format: vault_name/secret_name
        if "/" in secret_id:
            vault, sname = secret_id.split("/", 1)
            cmd = ["az", "keyvault", "secret", "show", "--vault-name", vault, "--name", sname, "--query", "value", "-o", "tsv"]
    elif provider == "vault":
        cmd = ["vault", "kv", "get", "-format=json", secret_id]

    if not cmd:
        return ""

    try:
        proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        raw = proc.stdout.strip()
        if not raw:
            return ""

        if provider == "vault":
            try:
                vault_json = json.loads(raw)
                data = vault_json.get("data", {}).get("data", {})
                return str(data.get(key, "")) if key else str(data)
            except Exception:
                return raw

        if key:
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, dict) and key in parsed:
                    return str(parsed[key])
            except Exception:
                pass

        return raw
    except Exception:
        return ""


def load_environment(environment: str, infra_root: Path, strict: bool = False) -> dict:
    """Loads and resolves dynamic environment variables for the target environment."""
    resolved = {}
    sources = {}

    # Locate designated environment folder
    env_dir = infra_root / "environments" / environment
    if not env_dir.is_dir():
        alt_dir = infra_root / "config" / "environments" / environment
        if alt_dir.is_dir():
            env_dir = alt_dir

    spec_file = env_dir / "secrets.spec.yaml"
    spec_data = {}
    if spec_file.is_file():
        if yaml:
            with open(spec_file, "r", encoding="utf-8") as f:
                spec_data = yaml.safe_load(f) or {}
        else:
            print(f"[load-env] Warning: PyYAML not found, cannot read {spec_file}", file=sys.stderr)

    # 1. Base Variables from secrets.spec.yaml
    base_vars = spec_data.get("variables", {})
    for k, v in base_vars.items():
        resolved[k] = str(v)
        sources[k] = "spec_default"

    # 2. .env file (Optional) - Loaded first as fallback before secrets
    dotenv_candidates = [
        env_dir / ".env",
        infra_root / "terraform" / "environments" / environment / ".env",
        infra_root / f".env.{environment}",
        infra_root / ".env"
    ]
    for candidate in dotenv_candidates:
        if candidate.is_file():
            dotenv_vars = parse_dotenv_file(candidate)
            for k, v in dotenv_vars.items():
                resolved[k] = v
                sources[k] = f"dotenv({candidate.name})"
            break  # Stop after first matching .env file

    # 3. Cloud Provider Secret Managers
    secret_managers = spec_data.get("secret_managers", [])
    for sm in secret_managers:
        var_name = sm.get("env_var")
        provider = sm.get("provider")
        secret_id = sm.get("secret_id")
        key = sm.get("key")
        is_optional = sm.get("optional", True)

        # Attempt to retrieve from secret manager
        secret_val = query_cloud_secret(provider, secret_id, key)
        if secret_val:
            resolved[var_name] = secret_val
            sources[var_name] = f"secret_manager({provider})"
        elif strict and not is_optional and var_name not in resolved:
            raise RuntimeError(f"Strict secret resolution failed: missing required secret '{var_name}' from {provider} ({secret_id})")

    # 4. CI/CD Secrets & Process Environment (Highest Precedence)
    # Check mapped CI/CD secret names
    ci_secrets = spec_data.get("ci_secrets", {})
    for target_var, ci_var in ci_secrets.items():
        if ci_var in os.environ and os.environ[ci_var]:
            resolved[target_var] = os.environ[ci_var]
            sources[target_var] = f"ci_secret({ci_var})"

    # Check direct process environment variables (override everything)
    for k, v in os.environ.items():
        if k in resolved or k.startswith("TF_VAR_") or k.startswith("APP_") or k.startswith("AWS_") or k in [
            "ENVIRONMENT", "INFRA_PROVIDER", "APPLICATION_SERVER_COUNT", "DEPLOYMENT_MODE", "DATABASE_URL", "API_SECRET_KEY", "SSH_PUBLIC_KEY"
        ]:
            # Do not overwrite if it's internal tooling noise unless specifically targeted
            if k in ["_", "PWD", "SHLVL", "OLDPWD"]:
                continue
            resolved[k] = v
            sources[k] = "process_env"

    # 5. SSH Public Key resolution helper
    if "SSH_PUBLIC_KEY" not in resolved or not resolved["SSH_PUBLIC_KEY"]:
        pub_key_path = resolved.get("SSH_PUBLIC_KEY_PATH", "~/.ssh/id_rsa.pub")
        expanded_path = Path(os.path.expanduser(pub_key_path))
        if expanded_path.is_file():
            try:
                resolved["SSH_PUBLIC_KEY"] = expanded_path.read_text(encoding="utf-8").strip()
                sources["SSH_PUBLIC_KEY"] = f"file({pub_key_path})"
            except Exception:
                pass
        elif environment in ["dev", "staging", "local"]:
            # Fallback placeholder for dev/local testing if no key on disk
            resolved["SSH_PUBLIC_KEY"] = "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC0fakeDummyKeyForPlatformValidation dev@local"
            sources["SSH_PUBLIC_KEY"] = "fallback_mock"

    # Always ensure ENVIRONMENT matches target
    resolved["ENVIRONMENT"] = environment

    return resolved


def generate_terraform_vars(resolved: dict, environment: str, infra_root: Path) -> dict:
    """Prepares and writes ephemeral terraform.tfvars.json."""
    tf_dir = infra_root / "terraform" / "environments" / environment
    if not tf_dir.is_dir():
        return {}

    tf_vars = {}

    # Mapping from resolved env names to terraform variable names
    tf_mapping = {
        "PROJECT_NAME": "project_name",
        "AWS_REGION": "aws_region",
        "APPLICATION_SERVER_COUNT": "application_server_count",
        "INSTANCE_TYPE": "instance_type",
        "SSH_PUBLIC_KEY": "ssh_public_key",
        "ADMIN_CIDR_BLOCKS": "admin_cidr_blocks",
        "DEPLOYMENT_MODE": "deployment_mode",
        "APP_PORT": "app_port",
    }

    for env_name, tf_name in tf_mapping.items():
        if env_name in resolved:
            val = resolved[env_name]
            # Convert types appropriately
            if tf_name == "application_server_count" or tf_name == "app_port":
                try:
                    tf_vars[tf_name] = int(val)
                except ValueError:
                    pass
            elif tf_name == "admin_cidr_blocks":
                if isinstance(val, str) and val.startswith("["):
                    try:
                        tf_vars[tf_name] = json.loads(val)
                    except json.JSONDecodeError:
                        tf_vars[tf_name] = [s.strip() for s in val.strip("[]").split(",") if s.strip()]
                elif isinstance(val, list):
                    tf_vars[tf_name] = val
                else:
                    tf_vars[tf_name] = [val]
            else:
                tf_vars[tf_name] = val

    tfvars_path = tf_dir / "terraform.tfvars.json"
    with open(tfvars_path, "w", encoding="utf-8") as f:
        json.dump(tf_vars, f, indent=2)

    return tf_vars


def generate_k8s_manifests(resolved: dict, environment: str, infra_root: Path):
    """Generates K8s ConfigMap and Secret manifests for overlays."""
    overlay_dir = infra_root / "kubernetes" / "overlays" / environment
    if not overlay_dir.is_dir():
        overlay_dir.mkdir(parents=True, exist_ok=True)

    # ConfigMap: Non-sensitive
    config_vars = {
        "ENVIRONMENT": resolved.get("ENVIRONMENT", environment),
        "NODE_ENV": resolved.get("NODE_ENV", "production"),
        "LOG_LEVEL": resolved.get("LOG_LEVEL", "info"),
        "PORT": str(resolved.get("APP_PORT", "8080")),
        "ENABLE_METRICS": str(resolved.get("ENABLE_METRICS", "true")),
    }

    cm_lines = [
        "apiVersion: v1",
        "kind: ConfigMap",
        "metadata:",
        f"  name: app-config",
        f"  namespace: {environment}",
        "data:",
    ]
    for k, v in config_vars.items():
        cm_lines.append(f'  {k}: "{v}"')

    with open(overlay_dir / "app-config.yaml", "w", encoding="utf-8") as f:
        f.write("\n".join(cm_lines) + "\n")

    # Secret: Sensitive
    secret_vars = {
        "DATABASE_URL": resolved.get("DATABASE_URL", ""),
        "API_SECRET_KEY": resolved.get("API_SECRET_KEY", ""),
    }

    sec_lines = [
        "apiVersion: v1",
        "kind: Secret",
        "metadata:",
        f"  name: app-secrets",
        f"  namespace: {environment}",
        "type: Opaque",
        "stringData:",
    ]
    for k, v in secret_vars.items():
        sec_lines.append(f'  {k}: "{v}"')

    with open(overlay_dir / "app-secrets.yaml", "w", encoding="utf-8") as f:
        f.write("\n".join(sec_lines) + "\n")


def generate_ansible_vars(resolved: dict, environment: str, infra_root: Path):
    """Generates group_vars for Ansible."""
    inv_dir = infra_root / "ansible" / "inventories" / environment / "group_vars" / "all"
    inv_dir.mkdir(parents=True, exist_ok=True)

    ansible_env = {
        "env_vars": {
            "ENVIRONMENT": resolved.get("ENVIRONMENT", environment),
            "NODE_ENV": resolved.get("NODE_ENV", "production"),
            "LOG_LEVEL": resolved.get("LOG_LEVEL", "info"),
            "PORT": str(resolved.get("APP_PORT", "8080")),
            "DATABASE_URL": resolved.get("DATABASE_URL", ""),
            "API_SECRET_KEY": resolved.get("API_SECRET_KEY", ""),
        }
    }

    with open(inv_dir / "env.yaml", "w", encoding="utf-8") as f:
        if yaml:
            yaml.dump(ansible_env, f, default_flow_style=False)
        else:
            json.dump(ansible_env, f, indent=2)


def main():
    parser = argparse.ArgumentParser(description="Platform Dynamic Environment & Secret Manager Loader")
    parser.add_argument("environment", choices=["local", "dev", "staging", "prod"], help="Target environment")
    parser.add_argument("action", choices=["export", "json", "dotenv", "tfvars", "k8s", "ansible", "run"], help="Action to execute")
    parser.add_argument("cmd", nargs=argparse.REMAINDER, help="Command to run when action is 'run'")
    parser.add_argument("--strict", action="store_true", help="Fail if required secrets cannot be resolved")

    args = parser.parse_args()
    infra_root = find_infra_root()

    resolved = load_environment(args.environment, infra_root, strict=args.strict)

    # Ensure Terraform variables TF_VAR_* are automatically mapped
    tf_mapping = {
        "PROJECT_NAME": "TF_VAR_project_name",
        "AWS_REGION": "TF_VAR_aws_region",
        "APPLICATION_SERVER_COUNT": "TF_VAR_application_server_count",
        "INSTANCE_TYPE": "TF_VAR_instance_type",
        "SSH_PUBLIC_KEY": "TF_VAR_ssh_public_key",
        "ADMIN_CIDR_BLOCKS": "TF_VAR_admin_cidr_blocks",
        "DEPLOYMENT_MODE": "TF_VAR_deployment_mode",
        "APP_PORT": "TF_VAR_app_port",
    }
    for env_k, tf_var in tf_mapping.items():
        if env_k in resolved:
            resolved[tf_var] = resolved[env_k]

    if args.action == "json":
        print(json.dumps(resolved, indent=2))

    elif args.action == "dotenv":
        for k, v in resolved.items():
            if not k.startswith("TF_VAR_"):
                print(f'{k}="{v}"')

    elif args.action == "export":
        for k, v in resolved.items():
            # Escape single quotes for safe shell evaluation
            safe_v = str(v).replace("'", "'\\''")
            print(f"export {k}='{safe_v}'")

    elif args.action == "tfvars":
        generate_terraform_vars(resolved, args.environment, infra_root)
        print(f"[load-env] Generated terraform.tfvars.json for '{args.environment}'")

    elif args.action == "k8s":
        generate_k8s_manifests(resolved, args.environment, infra_root)
        print(f"[load-env] Generated Kubernetes ConfigMap and Secret for '{args.environment}'")

    elif args.action == "ansible":
        generate_ansible_vars(resolved, args.environment, infra_root)
        print(f"[load-env] Generated Ansible environment variables for '{args.environment}'")

    elif args.action == "run":
        if not args.cmd:
            print("Error: No command provided to run.", file=sys.stderr)
            sys.exit(1)

        # Generate ephemeral terraform.tfvars.json so terraform always has the variables
        generate_terraform_vars(resolved, args.environment, infra_root)

        # Prepare execution environment
        exec_env = os.environ.copy()
        for k, v in resolved.items():
            exec_env[k] = str(v)

        # Execute command
        cmd = args.cmd
        # If passed as a single string inside args.cmd e.g. ["bash -c '...'"]
        if len(cmd) == 1 and (" " in cmd[0] or ";" in cmd[0]):
            res = subprocess.run(cmd[0], shell=True, env=exec_env, cwd=infra_root)
        else:
            res = subprocess.run(cmd, shell=False, env=exec_env, cwd=infra_root)
        sys.exit(res.returncode)


if __name__ == "__main__":
    main()
