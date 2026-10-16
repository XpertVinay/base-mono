# ==============================================================================
# LOCAL DOCKER PROVIDER ADAPTER: CORE & CONTAINER RESOURCES
# Purpose:
#   Provisions 1 to 5 local container instances on a dedicated Docker bridge
#   network, simulating cloud compute nodes completely offline.
# ==============================================================================

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# Dedicated local Docker bridge network (acts as VPC/Subnet)
resource "docker_network" "platform_net" {
  name   = "${local.name_prefix}-net"
  driver = "bridge"
}

# Base OS image for local nodes: Ubuntu 22.04 LTS
resource "docker_image" "node_base" {
  name         = "ubuntu:22.04"
  keep_locally = true
}

# 1 to 5 Local Container Nodes (Acting as simulated application servers)
resource "docker_container" "app_nodes" {
  count = var.application_server_count

  name  = "${local.name_prefix}-app-${count.index + 1}"
  image = docker_image.node_base.image_id

  # Keep container running with init
  command = ["/bin/sh", "-c", "apt-get update && apt-get install -y curl python3 sudo && exec sleep infinity"]

  networks_advanced {
    name = docker_network.platform_net.name
  }

  labels {
    label = "role"
    value = "application-server"
  }

  labels {
    label = "node_index"
    value = tostring(count.index + 1)
  }

  labels {
    label = "cluster_role"
    value = count.index == 0 ? "control-plane" : "worker"
  }

  # Port forward for the first node or primary entrypoint
  dynamic "ports" {
    for_each = count.index == 0 ? [1] : []
    content {
      internal = var.app_port
      external = var.app_port
    }
  }
}
