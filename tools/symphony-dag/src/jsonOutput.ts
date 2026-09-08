export const SYMPHONY_DAG_SCHEMA_VERSION = "symphony-dag/v1";

export type JsonOutput<T extends object> = {
  readonly schemaVersion: typeof SYMPHONY_DAG_SCHEMA_VERSION;
} & T;

export function withSchemaVersion<T extends object>(payload: T): JsonOutput<T> {
  return {
    schemaVersion: SYMPHONY_DAG_SCHEMA_VERSION,
    ...payload,
  };
}

export function formatJsonOutput(payload: object): string {
  return `${JSON.stringify(payload, null, 2)}\n`;
}
