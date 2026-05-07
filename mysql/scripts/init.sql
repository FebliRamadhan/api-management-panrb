-- ─────────────────────────────────────────
-- WSO2 API Manager - Database Initialization
-- ─────────────────────────────────────────

CREATE DATABASE IF NOT EXISTS apim_db CHARACTER SET latin1 COLLATE latin1_swedish_ci;
CREATE DATABASE IF NOT EXISTS shared_db CHARACTER SET latin1 COLLATE latin1_swedish_ci;

-- Grant permissions
GRANT ALL PRIVILEGES ON apim_db.* TO 'apimuser'@'%';
GRANT ALL PRIVILEGES ON shared_db.* TO 'apimuser'@'%';
FLUSH PRIVILEGES;
