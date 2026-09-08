import {
  formatJsonOutput,
  SYMPHONY_DAG_SCHEMA_VERSION,
  withSchemaVersion,
} from "./jsonOutput";

test("adds the stable DAG schema version", () => {
  expect(withSchemaVersion({ kind: "example" })).toEqual({
    schemaVersion: SYMPHONY_DAG_SCHEMA_VERSION,
    kind: "example",
  });
});

test("formats stable pretty JSON with a trailing newline", () => {
  expect(formatJsonOutput(withSchemaVersion({ kind: "example" }))).toBe(
    '{\n  "schemaVersion": "symphony-dag/v1",\n  "kind": "example"\n}\n'
  );
});
