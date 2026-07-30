#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

function usage() {
  console.error(
    "Usage: audit-alpine.mjs MAIN_DB COMMUNITY_DB LABEL=APK_INSTALLED_FILE [...]"
  );
  process.exit(2);
}

if (process.argv.length < 5) usage();

try {
  execFileSync("apk", ["--version"], { stdio: "ignore" });
} catch {
  console.error("Error: this helper must run in an Alpine environment with apk available.");
  process.exit(2);
}

const [, , mainDatabasePath, communityDatabasePath, ...targets] = process.argv;
const securityPackages = new Map();

for (const databasePath of [mainDatabasePath, communityDatabasePath]) {
  const database = JSON.parse(readFileSync(databasePath, "utf8"));
  for (const entry of database.packages ?? []) {
    if (entry?.pkg?.name && entry.pkg.secfixes) {
      securityPackages.set(entry.pkg.name, entry.pkg.secfixes);
    }
  }
}

function parseInstalledPackages(path) {
  return readFileSync(path, "utf8")
    .split(/\n{2,}/)
    .map((record) => {
      const fields = new Map();
      for (const line of record.split("\n")) {
        if (line[1] === ":" && !fields.has(line[0])) fields.set(line[0], line.slice(2));
      }
      return {
        name: fields.get("P"),
        version: fields.get("V"),
        origin: fields.get("o")
      };
    })
    .filter((entry) => entry.name && entry.version);
}

function isOlder(installedVersion, fixedVersion) {
  return (
    execFileSync("apk", ["version", "-t", installedVersion, fixedVersion], {
      encoding: "utf8"
    }).trim() === "<"
  );
}

let totalFindings = 0;

for (const target of targets) {
  const separator = target.indexOf("=");
  if (separator <= 0 || separator === target.length - 1) usage();
  const label = target.slice(0, separator);
  const installedPath = target.slice(separator + 1);
  const installedPackages = parseInstalledPackages(installedPath);
  const findings = new Map();

  for (const installed of installedPackages) {
    const sourceName = installed.origin ?? installed.name;
    const fixes = securityPackages.get(sourceName);
    if (!fixes) continue;

    for (const [fixedVersion, vulnerabilityIds] of Object.entries(fixes)) {
      // Alpine uses "0" for issues that do not affect the packaged build.
      if (fixedVersion === "0" || !isOlder(installed.version, fixedVersion)) continue;
      for (const vulnerabilityId of vulnerabilityIds) {
        const key = `${sourceName}:${vulnerabilityId}`;
        findings.set(key, {
          sourceName,
          installedVersion: installed.version,
          fixedVersion,
          vulnerabilityId
        });
      }
    }
  }

  console.log(
    `${label}: ${installedPackages.length} APK packages, ${findings.size} known unfixed security issues`
  );
  for (const finding of [...findings.values()].sort((left, right) =>
    left.vulnerabilityId.localeCompare(right.vulnerabilityId)
  )) {
    console.log(
      `  ${finding.vulnerabilityId} ${finding.sourceName} ${finding.installedVersion} < ${finding.fixedVersion}`
    );
  }
  totalFindings += findings.size;
}

if (totalFindings > 0) process.exitCode = 1;
