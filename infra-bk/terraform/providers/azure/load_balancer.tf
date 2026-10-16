# ==============================================================================
# AZURE PROVIDER ADAPTER: LOAD BALANCER
# Purpose:
#   Provisions an Azure Standard Load Balancer distributing ingress traffic
#   across the 1 to 5 provisioned VMs.
# ==============================================================================

# Public IP for Load Balancer
resource "azurerm_public_ip" "lb" {
  count = var.enable_load_balancer ? 1 : 0

  name                = "${local.name_prefix}-lb-pip"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.common_tags
}

# Standard Load Balancer
resource "azurerm_lb" "main" {
  count = var.enable_load_balancer ? 1 : 0

  name                = "${local.name_prefix}-alb"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  sku                 = "Standard"

  frontend_ip_configuration {
    name                 = "PublicFrontendIP"
    public_ip_address_id = azurerm_public_ip.lb[0].id
  }

  tags = local.common_tags
}

# Backend Address Pool
resource "azurerm_lb_backend_address_pool" "bepool" {
  count = var.enable_load_balancer ? 1 : 0

  loadbalancer_id = azurerm_lb.main[0].id
  name            = "${local.name_prefix}-bepool"
}

# Associate NICs with Backend Address Pool
resource "azurerm_network_interface_backend_address_pool_association" "nic_assoc" {
  count = var.enable_load_balancer ? var.application_server_count : 0

  network_interface_id    = azurerm_network_interface.app_nodes[count.index].id
  ip_configuration_name   = "internal"
  backend_address_pool_id = azurerm_lb_backend_address_pool.bepool[0].id
}

# Health Probe
resource "azurerm_lb_probe" "hp" {
  count = var.enable_load_balancer ? 1 : 0

  loadbalancer_id = azurerm_lb.main[0].id
  name            = "http-health-probe"
  port            = var.app_port
  protocol        = "Http"
  request_path    = "/health"
}

# Load Balancing Rule
resource "azurerm_lb_rule" "rule" {
  count = var.enable_load_balancer ? 1 : 0

  loadbalancer_id                = azurerm_lb.main[0].id
  name                           = "LBRule-App"
  protocol                       = "Tcp"
  frontend_port                  = var.app_port
  backend_port                   = var.app_port
  frontend_ip_configuration_name = "PublicFrontendIP"
  backend_address_pool_ids       = [azurerm_lb_backend_address_pool.bepool[0].id]
  probe_id                       = azurerm_lb_probe.hp[0].id
}
