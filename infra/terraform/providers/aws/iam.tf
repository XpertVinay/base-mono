# ==============================================================================
# AWS PROVIDER ADAPTER: IAM & INSTANCE IDENTITY
# Purpose:
#   Provisions least-privilege IAM roles and instance profiles for EC2 hosts,
#   enabling AWS Systems Manager (SSM) access without requiring static keys.
# ==============================================================================

# IAM Assume Role Policy for EC2
data "aws_iam_policy_document" "ec2_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

# IAM Role for Compute Instances
resource "aws_iam_role" "app_instance_role" {
  name               = "${local.name_prefix}-instance-role"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume_role.json

  tags = local.common_tags
}

# Attach AWS Systems Manager Core policy (Allows console terminal/break-glass access)
resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.app_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance Profile attached to EC2 instances
resource "aws_iam_instance_profile" "app_profile" {
  name = "${local.name_prefix}-instance-profile"
  role = aws_iam_role.app_instance_role.name

  tags = local.common_tags
}
