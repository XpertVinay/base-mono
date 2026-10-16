# ==============================================================================
# AWS PROVIDER ADAPTER: FIREWALL & SECURITY GROUPS
# Purpose:
#   Implements least-privilege network access controls for both the ingress
#   load balancer and application/cluster host instances.
# Security:
#   - Public ingress is restricted strictly to HTTP/HTTPS on the load balancer.
#   - Application instances only accept traffic forwarded by the load balancer.
#   - Administrative SSH is restricted to configured administrator CIDR blocks.
# ==============================================================================

# Security Group for Application Load Balancer
resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Controls inbound web traffic directly from the internet to the load balancer"
  vpc_id      = aws_vpc.main.id

  # Inbound HTTP
  ingress {
    description = "Allow inbound HTTP from permitted CIDRs"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Inbound HTTPS
  ingress {
    description = "Allow inbound HTTPS from permitted CIDRs"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound to VPC Application Instances
  egress {
    description = "Allow outbound to application tier"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-alb-sg"
    }
  )
}

# Security Group for Application Servers
resource "aws_security_group" "app_nodes" {
  name        = "${local.name_prefix}-app-nodes-sg"
  description = "Controls traffic into application nodes from the load balancer and administrators"
  vpc_id      = aws_vpc.main.id

  # Administrative SSH access
  ingress {
    description = "SSH access restricted to administrative networks"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.admin_cidr_blocks
  }

  # Application traffic originating from Load Balancer
  ingress {
    description     = "Inbound application traffic from ALB"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  # Internal intra-node cluster communication (Required for self-managed Kubernetes)
  ingress {
    description = "Intra-VPC inter-node cluster communication"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    self        = true
  }

  # Outbound access for package updates, container image pulls, and external APIs
  egress {
    description = "Allow outbound internet egress via NAT gateway"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-app-nodes-sg"
    }
  )
}
