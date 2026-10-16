#!/usr/bin/env python3
"""
Test Suite: Platform Dynamic Environmental Variables & Secret Management
Verifies:
  1. Designated folder resolution for each environment (local, dev, staging, prod)
  2. Optional .env file handling (works when present, succeeds without errors when absent)
  3. Cloud provider secret manager retrieval and JSON key extraction
  4. CI/CD secret precedence over secret managers and .env files
  5. Ephemeral terraform.tfvars.json generation
  6. Kubernetes ConfigMap and Secret generation
  7. Ansible environment variables generation
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

INFRA_ROOT = Path(__file__).resolve().parent.parent
LOAD_ENV_PY = INFRA_ROOT / "scripts" / "load-env.py"


class TestDynamicEnvironmentLoader(unittest.TestCase):
    def setUp(self):
        self.test_env = os.environ.copy()
        # Clean any polluting env vars
        for k in ["DATABASE_URL", "DEV_DATABASE_URL", "API_SECRET_KEY", "DEV_API_SECRET_KEY", "MOCK_SECRET_STORE"]:
            self.test_env.pop(k, None)

    def run_loader(self, env: str, action: str, extra_args: list = None, env_vars: dict = None) -> subprocess.CompletedProcess:
        cmd = [sys.executable, str(LOAD_ENV_PY), env, action]
        if extra_args:
            cmd.extend(extra_args)

        run_env = self.test_env.copy()
        if env_vars:
            run_env.update(env_vars)

        return subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=INFRA_ROOT,
            env=run_env
        )

    def test_designated_folders_exist(self):
        """Verify all designated environment folders exist and have secrets.spec.yaml."""
        for env in ["local", "dev", "staging", "prod"]:
            env_dir = INFRA_ROOT / "environments" / env
            self.assertTrue(env_dir.is_dir(), f"Designated folder missing: {env_dir}")
            self.assertTrue((env_dir / "secrets.spec.yaml").is_file(), f"secrets.spec.yaml missing in {env_dir}")
            self.assertTrue((env_dir / ".env.example").is_file(), f".env.example missing in {env_dir}")

    def test_default_resolution_without_dotenv(self):
        """Verify loader succeeds and provides defaults when no .env exists."""
        proc = self.run_loader("dev", "json")
        self.assertEqual(proc.returncode, 0, f"Stderr: {proc.stderr}")
        data = json.loads(proc.stdout)
        self.assertEqual(data["ENVIRONMENT"], "dev")
        self.assertEqual(data["INFRA_PROVIDER"], "aws")
        self.assertEqual(data["APPLICATION_SERVER_COUNT"], "1")
        self.assertIn("TF_VAR_aws_region", data)

    def test_optional_dotenv_loading(self):
        """Verify .env in designated folder is loaded if present."""
        dev_dir = INFRA_ROOT / "environments" / "dev"
        test_dotenv = dev_dir / ".env"
        try:
            test_dotenv.write_text("CUSTOM_DOTENV_KEY=from_dev_dotenv\nAPP_PORT=9090\n")
            proc = self.run_loader("dev", "json")
            self.assertEqual(proc.returncode, 0)
            data = json.loads(proc.stdout)
            self.assertEqual(data.get("CUSTOM_DOTENV_KEY"), "from_dev_dotenv")
            self.assertEqual(data.get("APP_PORT"), "9090")
        finally:
            if test_dotenv.exists():
                test_dotenv.unlink()

    def test_cloud_secret_manager_retrieval(self):
        """Verify secrets are dynamically extracted from cloud secret manager store."""
        mock_store = json.dumps({
            "dev/platform/database": {"url": "postgresql://cloud_user:cloud_pass@aurora:5432/db"},
            "dev/platform/api": {"api_key": "cloud-sec-999"},
            "/dev/platform/ssh_public_key": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC cloud@corp"
        })

        proc = self.run_loader("dev", "json", env_vars={"MOCK_SECRET_STORE": mock_store})
        self.assertEqual(proc.returncode, 0)
        data = json.loads(proc.stdout)
        self.assertEqual(data["DATABASE_URL"], "postgresql://cloud_user:cloud_pass@aurora:5432/db")
        self.assertEqual(data["API_SECRET_KEY"], "cloud-sec-999")
        self.assertEqual(data["SSH_PUBLIC_KEY"], "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIC cloud@corp")

    def test_cicd_secret_precedence(self):
        """Verify CI/CD secrets take precedence over both secret manager and .env."""
        mock_store = json.dumps({
            "dev/platform/database": {"url": "postgresql://cloud_user:cloud_pass@aurora:5432/db"}
        })

        dev_dir = INFRA_ROOT / "environments" / "dev"
        test_dotenv = dev_dir / ".env"
        try:
            test_dotenv.write_text("DATABASE_URL=postgresql://dotenv_user:dotenv_pass@local:5432/db\n")

            # 1. Without CI/CD secret, secret manager beats .env
            proc1 = self.run_loader("dev", "json", env_vars={"MOCK_SECRET_STORE": mock_store})
            data1 = json.loads(proc1.stdout)
            self.assertEqual(data1["DATABASE_URL"], "postgresql://cloud_user:cloud_pass@aurora:5432/db")

            # 2. With CI/CD secret, CI/CD secret beats everything
            proc2 = self.run_loader(
                "dev", "json",
                env_vars={
                    "MOCK_SECRET_STORE": mock_store,
                    "DEV_DATABASE_URL": "postgresql://cicd_winner:secret@runner:5432/db"
                }
            )
            data2 = json.loads(proc2.stdout)
            self.assertEqual(data2["DATABASE_URL"], "postgresql://cicd_winner:secret@runner:5432/db")

        finally:
            if test_dotenv.exists():
                test_dotenv.unlink()

    def test_ephemeral_tfvars_generation(self):
        """Verify terraform.tfvars.json is generated correctly with proper types."""
        proc = self.run_loader("staging", "tfvars")
        self.assertEqual(proc.returncode, 0)
        tfvars_path = INFRA_ROOT / "terraform" / "environments" / "staging" / "terraform.tfvars.json"
        self.assertTrue(tfvars_path.is_file())
        with open(tfvars_path) as f:
            vars_data = json.load(f)
        self.assertIsInstance(vars_data["application_server_count"], int)
        self.assertIsInstance(vars_data["admin_cidr_blocks"], list)
        self.assertEqual(vars_data["application_server_count"], 1)

    def test_k8s_manifest_generation(self):
        """Verify Kubernetes ConfigMap and Secret are generated."""
        proc = self.run_loader("dev", "k8s")
        self.assertEqual(proc.returncode, 0)
        cm_path = INFRA_ROOT / "kubernetes" / "overlays" / "dev" / "app-config.yaml"
        sec_path = INFRA_ROOT / "kubernetes" / "overlays" / "dev" / "app-secrets.yaml"
        self.assertTrue(cm_path.is_file())
        self.assertTrue(sec_path.is_file())

    def test_ansible_group_vars_generation(self):
        """Verify Ansible group_vars env.yaml is generated."""
        proc = self.run_loader("dev", "ansible")
        self.assertEqual(proc.returncode, 0)
        ansible_var_path = INFRA_ROOT / "ansible" / "inventories" / "dev" / "group_vars" / "all" / "env.yaml"
        self.assertTrue(ansible_var_path.is_file())

    def test_local_k8s_manifest_generation(self):
        """Verify local Kubernetes manifests and overlay compilation."""
        proc = self.run_loader("local", "k8s")
        self.assertEqual(proc.returncode, 0)
        cm_path = INFRA_ROOT / "kubernetes" / "overlays" / "local" / "app-config.yaml"
        sec_path = INFRA_ROOT / "kubernetes" / "overlays" / "local" / "app-secrets.yaml"
        self.assertTrue(cm_path.is_file())
        self.assertTrue(sec_path.is_file())

        # Test kubectl kustomize compilation
        kust_proc = subprocess.run(
            ["kubectl", "kustomize", "kubernetes/overlays/local"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=INFRA_ROOT
        )
        self.assertEqual(kust_proc.returncode, 0, f"Local kustomize error: {kust_proc.stderr}")
        self.assertIn("NodePort", kust_proc.stdout)
        self.assertIn("30080", kust_proc.stdout)


if __name__ == "__main__":
    unittest.main()
