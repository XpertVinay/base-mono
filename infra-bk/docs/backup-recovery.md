# Backup, Disaster Recovery & State Migration

## 1. Disambiguation: Infrastructure vs Data Recovery

- **Stateless Infrastructure Recreation**: Since all networking, compute nodes, security policies, and orchestrators are declared in Terraform and Ansible, loss of a compute node or an entire region requires simply re-running `make provision` against a new region or backup state.
- **Application & Persistent Data Recovery**: Application databases and persistent storage volumes attached via `/dev/xvdf` require dedicated point-in-time snapshotting and object storage replication.

---

## 2. Terraform State Backup & Recovery

1. **State Isolation**: Dev, Staging, and Production maintain physically separate `.tfstate` files in versioned, encrypted object storage buckets.
2. **State Locking**: DynamoDB (AWS) prevents concurrent execution race conditions.
3. **State Corruption Recovery**:
   If state is damaged, retrieve previous object versions from the versioned S3 bucket:
   ```bash
   aws s3api list-object-versions --bucket platform-tf-state-prod --prefix prod/terraform.tfstate
   ```

---

## 3. Persistent Volume Snapshots

For persistent EBS data disks attached to instances:
- AWS Data Lifecycle Manager (DLM) schedules automated daily snapshots retained for 30 days.
- Disaster recovery restores volumes from snapshot ID by populating the snapshot ID in `instances.tf`.
