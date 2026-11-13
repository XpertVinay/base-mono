const FORBIDDEN_SQL_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'TRUNCATE',
  'CREATE',
  'GRANT',
  'REVOKE',
  'MERGE',
  'REPLACE',
  'COPY',
  'CALL',
  'EXEC',
  'EXECUTE',
  'DO',
  'SET',
  'VACUUM',
  'ANALYZE',
  'LOCK',
  'INTO'
];

export interface SqlValidationResult {
  valid: boolean;
  sanitizedSql?: string;
  reason?: string;
}

export class SqlSafetyValidator {
  /**
   * Validates that an incoming SQL statement is strictly read-only (single SELECT or WITH ... SELECT),
   * does not contain stacked statements, comments that hide payloads, or forbidden mutating keywords,
   * and enforces a maximum LIMIT.
   */
  public static validateReadOnlyQuery(
    rawSql: string,
    options?: { maxLimit?: number; allowedSchemas?: string[] }
  ): SqlValidationResult {
    if (!rawSql || typeof rawSql !== 'string') {
      return { valid: false, reason: 'SQL query must be a non-empty string' };
    }

    const trimmed = rawSql.trim().replace(/;+\s*$/, '');
    if (!trimmed) {
      return { valid: false, reason: 'SQL query cannot be empty' };
    }

    // Disallow SQL comments and stacked statements outside string literals
    const strippedStrings = trimmed.replace(/'(?:''|[^'])*'/g, "''");
    if (strippedStrings.includes(';') || strippedStrings.includes('--') || strippedStrings.includes('/*')) {
      return {
        valid: false,
        reason: 'Multi-statement queries and SQL comments are not permitted in read-only MCP database tools'
      };
    }

    const upper = strippedStrings.toUpperCase();
    if (!upper.startsWith('SELECT ') && !upper.startsWith('WITH ')) {
      return { valid: false, reason: 'Only SELECT or WITH (CTE) read-only queries are permitted' };
    }

    for (const kw of FORBIDDEN_SQL_KEYWORDS) {
      const re = new RegExp(`\\b${kw}\\b`, 'i');
      if (re.test(strippedStrings)) {
        return { valid: false, reason: `Forbidden SQL keyword '${kw}' detected in read-only query` };
      }
    }

    // Optional schema allowlist check on schema.table references
    if (options?.allowedSchemas && options.allowedSchemas.length > 0) {
      const allowedSet = new Set(options.allowedSchemas.map(s => s.toLowerCase()));
      const schemaMatches = strippedStrings.matchAll(/\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)\.[a-zA-Z_][a-zA-Z0-9_]*/gi);
      for (const match of schemaMatches) {
        const schemaName = match[1].toLowerCase();
        if (!allowedSet.has(schemaName) && schemaName !== 'information_schema' && schemaName !== 'pg_catalog') {
          return {
            valid: false,
            reason: `Schema '${schemaName}' is not in the allowed schemas list`
          };
        }
      }
    }

    const maxLimit = options?.maxLimit ?? 100;
    const hasLimit = /\bLIMIT\s+\d+\b/i.test(strippedStrings);
    const sanitizedSql = hasLimit ? trimmed : `${trimmed} LIMIT ${maxLimit}`;

    return { valid: true, sanitizedSql };
  }
}

