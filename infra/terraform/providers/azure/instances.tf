# ==============================================================================
# AZURE PROVIDER ADAPTER: VIRTUAL MACHINES (1 TO 5 NODES)
# Purpose:
#   Provisions 1 to 5 Ubuntu Linux Virtual Machines in Azure.
# ==============================================================================

# Public IPs for instances (allows SSH management and individual node reachability)
resource "azurerm_public_ip" "app_nodes" {
  count = var.application_server_count

  name                = "${local.name_prefix}-app-pip-${count.index + 1}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = local.common_tags
}

# Network Interfaces for instances
resource "azurerm_network_interface" "app_nodes" {
  count = var.application_server_count

  name                = "${local.name_prefix}-app-nic-${count.index + 1}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.app.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.app_nodes[count.index].id
  }

  tags = local.common_tags
}

# 1 to 5 Application Virtual Machines
resource "azurerm_linux_virtual_machine" "app_nodes" {
  count = var.application_server_count

  name                = "${local.name_prefix}-app-${count.index + 1}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  size                = var.vm_size
  admin_username      = var.admin_username

  disable_password_authentication = true

  network_interface_ids = [
    azurerm_network_interface.app_nodes[count.index].id
  ]

  admin_ssh_key {
    username   = var.admin_username
    public_key = var.ssh_public_key
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = var.os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  tags = merge(
    local.common_tags,
    {
      Role        = "application-server"
      NodeIndex   = tostring(count.index + 1)
      ClusterRole = count.index == 0 ? "control-plane" : "worker"
    }
  )
}
