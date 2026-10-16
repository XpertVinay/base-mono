# ==============================================================================
# AZURE PROVIDER ADAPTER: MANAGED KUBERNETES (AKS)
# Purpose:
#   Provisions an Azure Kubernetes Service (AKS) cluster when
#   deployment_mode is set to 'k8s-managed'.
# Sizing:
#   Strictly enforces 1 to 5 worker nodes matching application_server_count.
# ==============================================================================

resource "azurerm_kubernetes_cluster" "aks" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name                = "${local.name_prefix}-aks"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  dns_prefix          = "${local.name_prefix}-k8s"

  default_node_pool {
    name            = "default"
    node_count      = var.application_server_count
    vm_size         = var.vm_size
    os_disk_size_gb = var.os_disk_size_gb
    vnet_subnet_id  = azurerm_subnet.app.id
  }

  identity {
    type = "SystemAssigned"
  }

  network_profile {
    network_plugin    = "kubenet"
    load_balancer_sku = "standard"
  }

  tags = local.common_tags
}
