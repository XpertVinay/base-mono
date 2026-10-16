# ==============================================================================
# AWS PROVIDER ADAPTER: APPLICATION LOAD BALANCER (ALB)
# Purpose:
#   Distributes incoming client traffic across the 1-5 application instances.
# Health Checks:
#   Continuously monitors instance availability on the configured health path.
# ==============================================================================

resource "aws_lb" "main" {
  count = var.enable_load_balancer ? 1 : 0

  name               = "${substr(local.name_prefix, 0, 26)}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "prod" ? true : false

  tags = merge(
    local.common_tags,
    {
      Name = "${local.name_prefix}-alb"
    }
  )
}

# Target Group for routing traffic to application servers
resource "aws_lb_target_group" "app" {
  count = var.enable_load_balancer ? 1 : 0

  name     = "${substr(local.name_prefix, 0, 26)}-tg"
  port     = var.app_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = "/health"
    port                = tostring(var.app_port)
    protocol            = "HTTP"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
    matcher             = "200-399"
  }

  tags = local.common_tags
}

# Attach each provisioned EC2 instance to the target group
resource "aws_lb_target_group_attachment" "app_attachment" {
  count = var.enable_load_balancer ? var.application_server_count : 0

  target_group_arn = aws_lb_target_group.app[0].arn
  target_id        = aws_instance.app_nodes[count.index].id
  port             = var.app_port
}

# HTTP Listener on port 80 forwarding to the target group
resource "aws_lb_listener" "http" {
  count = var.enable_load_balancer ? 1 : 0

  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app[0].arn
  }
}
