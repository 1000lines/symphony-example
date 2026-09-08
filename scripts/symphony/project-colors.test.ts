import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  LinearProjectInput,
  parseLinearProjectMetadata,
  readProjectColorFixture,
  selectAvailableProjectColor,
  SYMPHONY_PROJECT_COLORS,
} from "./project-colors";

function test(name: string, fn: () => void) {
  fn();
  console.info(`ok - ${name}`);
}

test("valid metadata returns an available supported project color", () => {
  const result = selectAvailableProjectColor([
    project({
      name: "sample-factory",
      state: "started",
      content: metadata({
        "project-code": "sample-factory",
        "project-color": "blue",
        "human-lead": "Example Lead",
      }),
    }),
  ]);

  assert.equal(result.available, true);
  assert.ok(SYMPHONY_PROJECT_COLORS.includes(result.color));
  assert.notEqual(result.color, "blue");
  assert.deepEqual(result.audit.usedColors, ["blue"]);
});

test("planned projects are active for color occupancy", () => {
  const result = selectAvailableProjectColor([
    project({
      name: "planned-project",
      state: "planned",
      content: metadata({
        "project-code": "planned-project",
        "project-color": "cyan",
        "human-lead": "Example Lead",
      }),
    }),
  ]);

  assert.equal(result.available, true);
  assert.deepEqual(result.audit.usedColors, ["cyan"]);
});

test("missing active project metadata blocks selection", () => {
  const result = selectAvailableProjectColor([
    project({
      name: "missing-color",
      state: "started",
      content: metadata({
        "project-code": "missing-color",
      }),
    }),
  ]);

  assert.equal(result.available, false);
  assert.match(result.reason, /missing project-color/);
  assert.equal(result.audit.problems[0].type, "missing-metadata");
});

test("duplicate active colors are reported as conflicts", () => {
  const result = selectAvailableProjectColor([
    project({
      name: "first",
      state: "started",
      content: metadata({
        "project-code": "first",
        "project-color": "cyan",
        "human-lead": "Example Lead",
      }),
    }),
    project({
      name: "second",
      state: "started",
      content: metadata({
        "project-code": "second",
        "project-color": "cyan",
        "human-lead": "Example Lead",
      }),
    }),
  ]);

  assert.equal(result.available, false);
  assert.match(
    result.reason,
    /color "cyan" is used by more than one active project/
  );
  assert.equal(result.audit.problems[0].type, "duplicate-active-color");
});

test("inactive projects are included in audit context but do not occupy colors", () => {
  const result = selectAvailableProjectColor([
    project({
      name: "finished",
      state: "completed",
      content: metadata({
        "project-code": "finished",
        "project-color": "pink",
        "human-lead": "Example Lead",
      }),
    }),
  ]);

  assert.equal(result.available, true);
  assert.equal(result.color, "pink");
  assert.deepEqual(result.audit.usedColors, []);
  assert.equal(result.audit.inactiveProjects.length, 1);
  assert.equal(result.audit.inactiveProjects[0].projectColor, "pink");
});

test("unknown active project colors are reported", () => {
  const result = selectAvailableProjectColor([
    project({
      name: "unknown-color",
      state: "started",
      content: metadata({
        "project-code": "unknown-color",
        "project-color": "magenta",
        "human-lead": "Example Lead",
      }),
    }),
  ]);

  assert.equal(result.available, false);
  assert.match(result.reason, /unknown color "magenta"/);
  assert.equal(result.audit.problems[0].type, "unknown-color");
});

test("all supported colors unavailable returns a concrete reason", () => {
  const result = selectAvailableProjectColor(
    SYMPHONY_PROJECT_COLORS.map((color) =>
      project({
        name: color,
        state: "started",
        content: metadata({
          "project-code": color,
          "project-color": color,
          "human-lead": "Example Lead",
        }),
      })
    )
  );

  assert.equal(result.available, false);
  assert.match(result.reason, /No Symphony project colors are available/);
  for (const color of SYMPHONY_PROJECT_COLORS) {
    assert.match(result.reason, new RegExp(color));
  }
});

test("project metadata parser extracts required fields and defaults base branch", () => {
  const parsed = parseLinearProjectMetadata(
    project({
      name: "sample-factory",
      state: "started",
      url: "https://linear.app/example-workspace/project/sample-factory",
      content: metadata({
        "project-code": "sample-factory",
        "project-color": "blue",
        "human-lead": "Example Lead",
      }),
    })
  );

  assert.equal(parsed.projectCode, "sample-factory");
  assert.equal(parsed.projectColor, "blue");
  assert.equal(parsed.baseBranch, "main");
  assert.equal(parsed.humanLead, "Example Lead");
  assert.equal(parsed.projectState, "started");
  assert.equal(
    parsed.projectUrl,
    "https://linear.app/example-workspace/project/sample-factory"
  );
});

test("project metadata parser accepts underscore keys from fan-out metadata", () => {
  const parsed = parseLinearProjectMetadata(
    project({
      state: "started",
      content: metadata({
        project_code: "sample-factory",
        project_color: "blue",
        base_branch: "main",
        human_lead: "Example Lead",
      }),
    })
  );

  assert.equal(parsed.projectCode, "sample-factory");
  assert.equal(parsed.projectColor, "blue");
  assert.equal(parsed.baseBranch, "main");
  assert.equal(parsed.humanLead, "Example Lead");
});

test("fixture reader accepts an offline projects fixture", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-colors-"));
  const fixturePath = path.join(tempDir, "projects.json");
  fs.writeFileSync(
    fixturePath,
    JSON.stringify({
      projects: [
        project({
          state: "started",
          content: metadata({
            "project-code": "sample-factory",
            "project-color": "blue",
            "human-lead": "Example Lead",
          }),
        }),
      ],
    })
  );

  const projects = readProjectColorFixture(fixturePath);
  assert.equal(projects.length, 1);
  assert.equal(selectAvailableProjectColor(projects).available, true);
});

test("project metadata parser requires a human lead", () => {
  const parsed = parseLinearProjectMetadata(
    project({
      state: "started",
      content: metadata({
        "project-code": "missing-human-lead",
        "project-color": "blue",
      }),
    })
  );

  assert.deepEqual(parsed.missingRequiredFields, ["human-lead"]);
});

function project(input: LinearProjectInput): LinearProjectInput {
  return input;
}

function metadata(values: Record<string, string>) {
  return Object.entries(values)
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
