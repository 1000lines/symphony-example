#!/usr/bin/env node
import { AwsSdkSymphonyHostAws } from "./aws";
import { runCommand } from "./commands";

void runCommand(process.argv.slice(2), {
  aws: new AwsSdkSymphonyHostAws(),
}).then((exitCode) => {
  process.exitCode = exitCode;
});
