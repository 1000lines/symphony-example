#!/usr/bin/env node

import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { routeMiscProjectOnTicketStart } from "./route-misc-project.mjs";

function readFlag(args, flag) {
  const index = args.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  if (!args[index + 1] || args[index + 1].startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return args[index + 1];
}

function issueIdentifier(args, env = process.env) {
  return (
    readFlag(args, "--issue") ||
    args.find((arg) => !arg.startsWith("--")) ||
    env.SYMPHONY_ISSUE_IDENTIFIER ||
    basename(process.cwd())
  );
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("-h") || args.includes("--help")) {
    console.info(HELP_TEXT);
    return;
  }
  if (!args.includes("--apply")) {
    throw new Error(
      "Ticket-start misc project routing must be invoked with --apply."
    );
  }

  const result = await routeMiscProjectOnTicketStart(issueIdentifier(args));
  console.info(JSON.stringify(result, null, 2));
}

const HELP_TEXT = `
Usage:
  node scripts/symphony/route-misc-project-on-ticket-start.mjs --issue DEMO-123 --apply

Runs from the Symphony ticket-start hook. Issues that already have a Linear
project are skipped; no-project DEMO issues invoke the misc project router in
apply mode.
`.trim();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
