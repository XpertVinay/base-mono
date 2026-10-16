CREATE SCHEMA IF NOT EXISTS scheduler;

CREATE TABLE IF NOT EXISTS scheduler.jobs (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    cron_expression VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED',
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO scheduler.jobs (id, name, cron_expression, status)
VALUES ('job-heartbeat-1', 'SYSTEM_HEARTBEAT', '*/5 * * * *', 'SCHEDULED')
ON CONFLICT (id) DO NOTHING;
