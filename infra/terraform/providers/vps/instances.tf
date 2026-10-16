# ==============================================================================
# GENERIC VPS PROVIDER ADAPTER: INSTANCE REGISTRATION & VERIFICATION
# Purpose:
#   Registers the static single VPS instance and optionally validates
#   SSH reachability and runtime prerequisites.
# ==============================================================================

resource "null_resource" "vps_node" {
  count = var.verify_ssh_connectivity ? 1 : 0

  triggers = {
    vps_ip   = var.vps_ipv4
    ssh_user = var.ssh_user
    ssh_port = tostring(var.ssh_port)
  }

  connection {
    type        = "ssh"
    user        = var.ssh_user
    host        = var.vps_ipv4
    port        = var.ssh_port
    private_key = fileexists(pathexpand(var.ssh_private_key_path)) ? file(pathexpand(var.ssh_private_key_path)) : null
    timeout     = "30s"
  }

  provisioner "remote-exec" {
    inline = [
      "echo '=== VPS Connectivity Check ==='",
      "uname -a",
      "uptime",
      "which python3 || echo 'Notice: python3 not found yet (Ansible bootstrap will install it).'"
    ]
  }
}
