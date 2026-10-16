# ==============================================================================
# AWS PROVIDER ADAPTER: APPLICATION COMPUTE INSTANCES
# Purpose:
#   Provisions standalone application compute instances based on the strictly
#   validated application_server_count (1 to 5).
# Scaling & Reliability:
#   Distributes instances across available private subnets for multi-AZ resiliency.
# ==============================================================================

# SSH Key Pair for remote access
resource "aws_key_pair" "admin" {
  key_name   = "${local.name_prefix}-admin-key"
  public_key = var.ssh_public_key

  tags = local.common_tags
}

# Standalone Application Server EC2 Instances (Count: 1 to 5)
resource "aws_instance" "app_nodes" {
  count = var.application_server_count

  ami                  = data.aws_ami.ubuntu.id
  instance_type        = var.instance_type
  key_name             = aws_key_pair.admin.key_name
  iam_instance_profile = aws_iam_instance_profile.app_profile.name

  # Round-robin distribution across available private subnets
  subnet_id = aws_subnet.private[count.index % length(aws_subnet.private)].id

  vpc_security_group_ids = [
    aws_security_group.app_nodes.id
  ]

  # Root Block Device
  root_block_device {
    volume_size           = var.root_volume_size_gb
    volume_type           = "gp3"
    encrypted             = true
    delete_on_termination = true

    tags = merge(
      local.common_tags,
      {
        Name = "${local.name_prefix}-app-${count.index + 1}-root"
      }
    )
  }

  # Cloud-init baseline: ensure packages and python3 are ready for Ansible
  user_data = <<-EOF
              #!/bin/bash
              set -e
              apt-get update -y
              apt-get install -y python3 python3-pip curl jq
              echo "Host initialization complete." > /var/log/provision-init.log
              EOF

  tags = merge(
    local.common_tags,
    {
      Name        = "${local.name_prefix}-app-${count.index + 1}"
      Role        = "application-server"
      NodeIndex   = tostring(count.index + 1)
      ClusterRole = count.index == 0 ? "control-plane" : "worker"
    }
  )

  lifecycle {
    ignore_changes = [ami]
  }
}

# Persistent Data Disk (EBS Volume) per instance for stateful container storage
resource "aws_ebs_volume" "data_volumes" {
  count = var.application_server_count

  availability_zone = aws_instance.app_nodes[count.index].availability_zone
  size              = 20
  type              = "gp3"
  encrypted         = true

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-app-${count.index + 1}-data"
    }
  )
}

resource "aws_volume_attachment" "data_attachments" {
  count = var.application_server_count

  device_name = "/dev/xvdf"
  volume_id   = aws_ebs_volume.data_volumes[count.index].id
  instance_id = aws_instance.app_nodes[count.index].id
}
