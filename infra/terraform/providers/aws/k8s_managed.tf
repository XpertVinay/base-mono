# ==============================================================================
# AWS PROVIDER ADAPTER: MANAGED KUBERNETES (AWS EKS)
# Purpose:
#   Provisions an enterprise-grade AWS EKS cluster when 'deployment_mode'
#   is explicitly set to 'k8s-managed'.
# Operational Principle:
#   Keeps managed node count completely separate from application_server_count.
# ==============================================================================

# EKS Cluster IAM Role
resource "aws_iam_role" "eks_cluster_role" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name = "${local.name_prefix}-eks-cluster-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "eks.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.eks_cluster_role[0].name
}

# AWS EKS Control Plane
resource "aws_eks_cluster" "main" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name     = "${local.name_prefix}-eks"
  role_arn = aws_iam_role.eks_cluster_role[0].arn
  version  = "1.29"

  vpc_config {
    subnet_ids              = concat(aws_subnet.public[*].id, aws_subnet.private[*].id)
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  depends_on = [aws_iam_role_policy_attachment.eks_cluster_policy]

  tags = local.common_tags
}

# EKS Node Group IAM Role
resource "aws_iam_role" "eks_node_role" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  name = "${local.name_prefix}-eks-node-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "eks_worker_policy" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
  role       = aws_iam_role.eks_node_role[0].name
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
  role       = aws_iam_role.eks_node_role[0].name
}

resource "aws_iam_role_policy_attachment" "eks_registry_policy" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
  role       = aws_iam_role.eks_node_role[0].name
}

# EKS Managed Node Group
resource "aws_eks_node_group" "main" {
  count = var.deployment_mode == "k8s-managed" ? 1 : 0

  cluster_name    = aws_eks_cluster.main[0].name
  node_group_name = "${local.name_prefix}-workers"
  node_role_arn   = aws_iam_role.eks_node_role[0].arn
  subnet_ids      = aws_subnet.private[*].id

  scaling_config {
    desired_size = var.k8s_managed_node_count
    max_size     = var.k8s_managed_node_count + 2
    min_size     = 1
  }

  instance_types = [var.instance_type]

  depends_on = [
    aws_iam_role_policy_attachment.eks_worker_policy,
    aws_iam_role_policy_attachment.eks_cni_policy,
    aws_iam_role_policy_attachment.eks_registry_policy,
  ]

  tags = local.common_tags
}
