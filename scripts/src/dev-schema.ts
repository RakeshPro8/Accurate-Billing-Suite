import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

type TableDefinition = {
  name: string;
  createStatement: string;
  columns: Map<string, string>;
};

type IndexDefinition = {
  name: string;
  statement: string;
};

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const identifierPattern = /^[a-z_][a-z0-9_]*$/;

function quoteIdentifier(identifier: string): string {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Unsafe schema identifier from Drizzle export: ${identifier}`);
  }
  return `"${identifier}"`;
}

function getDrizzleExport(): string {
  return execFileSync(
    "pnpm",
    ["--filter", "@workspace/db", "exec", "drizzle-kit", "export", "--config", "./drizzle.config.ts"],
    {
      cwd: workspaceRoot,
      env: process.env,
      encoding: "utf8",
      maxBuffer: 4 * 1024 * 1024,
    },
  );
}

function parseDefinitions(sql: string): { tables: TableDefinition[]; indexes: IndexDefinition[] } {
  const tables: TableDefinition[] = [];
  const tablePattern = /CREATE TABLE "([^"]+)" \(([\s\S]*?)\);/g;
  for (const match of sql.matchAll(tablePattern)) {
    const [, name, body] = match;
    const columns = new Map<string, string>();
    for (const rawDefinition of body.split("\n")) {
      const definition = rawDefinition.trim().replace(/,$/, "");
      const columnMatch = definition.match(/^"([^"]+)"\s+(.+)$/);
      if (columnMatch) {
        const [, columnName, columnDefinition] = columnMatch;
        columns.set(columnName, columnDefinition);
      }
    }
    tables.push({
      name,
      createStatement: `CREATE TABLE "${name}" (${body});`,
      columns,
    });
  }

  const indexes: IndexDefinition[] = [];
  const indexPattern = /CREATE UNIQUE INDEX "([^"]+)"[^;]+;/g;
  for (const match of sql.matchAll(indexPattern)) {
    const [, name] = match;
    indexes.push({
      name,
      statement: match[0],
    });
  }

  if (!tables.length) {
    throw new Error("Drizzle export did not contain any table definitions.");
  }
  return { tables, indexes };
}

async function syncDevelopmentSchema(): Promise<void> {
  const { tables, indexes } = parseDefinitions(getDrizzleExport());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const table of tables) {
      const tableName = quoteIdentifier(table.name);
      await client.query(table.createStatement.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS "));

      const existingColumns = await client.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [table.name],
      );
      const existing = new Set(existingColumns.rows.map((row) => row.column_name));
      for (const [columnName, columnDefinition] of table.columns) {
        if (!existing.has(columnName)) {
          await client.query(
            `ALTER TABLE ${tableName} ADD COLUMN IF NOT EXISTS ${quoteIdentifier(columnName)} ${columnDefinition}`,
          );
          console.log(`Added ${table.name}.${columnName}`);
        }
      }
    }

    for (const index of indexes) {
      if (!identifierPattern.test(index.name)) {
        throw new Error(`Unsafe index identifier from Drizzle export: ${index.name}`);
      }
      await client.query(index.statement.replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS "));
    }

    await client.query("COMMIT");
    console.log(`Development schema sync applied additively for ${tables.length} tables.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

async function verifyDevelopmentSchema(requireDefaultLocation: boolean): Promise<void> {
  const { tables, indexes } = parseDefinitions(getDrizzleExport());
  const client = await pool.connect();
  try {
    const missingTables: string[] = [];
    const missingColumns: string[] = [];
    const missingIndexes: string[] = [];

    for (const table of tables) {
      const tableResult = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = $1
         ) AS exists`,
        [table.name],
      );
      if (!tableResult.rows[0]?.exists) {
        missingTables.push(table.name);
        continue;
      }

      const columnResult = await client.query<{ column_name: string }>(
        `SELECT column_name
           FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = $1`,
        [table.name],
      );
      const existing = new Set(columnResult.rows.map((row) => row.column_name));
      for (const columnName of table.columns.keys()) {
        if (!existing.has(columnName)) {
          missingColumns.push(`${table.name}.${columnName}`);
        }
      }
    }

    for (const index of indexes) {
      const indexResult = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1
             FROM pg_indexes
            WHERE schemaname = 'public' AND indexname = $1
         ) AS exists`,
        [index.name],
      );
      if (!indexResult.rows[0]?.exists) {
        missingIndexes.push(index.name);
      }
    }

    if (missingTables.length || missingColumns.length || missingIndexes.length) {
      const details = [
        missingTables.length ? `tables: ${missingTables.join(", ")}` : "",
        missingColumns.length ? `columns: ${missingColumns.join(", ")}` : "",
        missingIndexes.length ? `indexes: ${missingIndexes.join(", ")}` : "",
      ].filter(Boolean).join("; ");
      throw new Error(`Development database is behind the Drizzle schema (${details}). Run db:sync before exercising the app.`);
    }

    if (requireDefaultLocation) {
      const defaultLocation = await client.query<{ id: number }>(
        `SELECT id
           FROM stores
          WHERE active = true AND is_default = true
          ORDER BY id
          LIMIT 1`,
      );
      if (!defaultLocation.rowCount) {
        throw new Error(
          "Development onboarding is incomplete: create an active default location before exercising store-scoped pages.",
        );
      }
    }

    console.log(
      `Development schema verification passed${requireDefaultLocation ? " with an active default location" : ""}.`,
    );
  } finally {
    client.release();
    await pool.end();
  }
}

const command = process.argv[2] ?? "verify";
const requireDefaultLocation = process.argv.includes("--require-default-location");

try {
  if (command === "sync") {
    await syncDevelopmentSchema();
  } else if (command === "verify") {
    await verifyDevelopmentSchema(requireDefaultLocation);
  } else {
    throw new Error(`Unknown command "${command}". Use "sync" or "verify".`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}