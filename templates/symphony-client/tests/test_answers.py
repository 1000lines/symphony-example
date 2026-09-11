"""Exercise the question package without depending on the client-file inventory."""

import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

import yaml


PACKAGE = Path(__file__).resolve().parents[1]
QUESTIONS = {
    "repo_slug",
    "default_branch",
    "linear_team_key",
    "symphony_app_slug",
    "cadence_app_slug",
    "build_command",
    "test_command",
}
GITHUB_SECRET = "${{ secrets.CADENCE_APP_PRIVATE_KEY }}"


class AnswersTest(unittest.TestCase):
    def setUp(self):
        # Stay inside the checkout even when the system temp directory is elsewhere.
        temporary = tempfile.TemporaryDirectory(prefix=".copier-test-", dir=Path.cwd())
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name).resolve()
        self.source = self.root / "source"
        self.source.mkdir()
        shutil.copyfile(PACKAGE / "copier.yml", self.source / "copier.yml")
        self.write("README.md", "ROOT-ONLY-DOC\n")
        self.write(".github/workflows/ci.yml", "ROOT-ONLY-WORKFLOW\n")
        self.write(".symphony.cfg.json", '{"root-only": true}\n')
        self.write("tests/test_root_only.py", 'raise AssertionError("root only")\n')
        self.write(
            "template/[[ _copier_conf.answers_file ]].jinja",
            "# Changes here will be overwritten by Copier; NEVER EDIT MANUALLY\n"
            "[[ _copier_answers | to_nice_yaml ]]\n",
        )
        self.write(
            "template/.github/workflows/client.yml.jinja",
            """# Repository: [[ repo_slug ]]
name: [[ repo_slug | to_json ]]
"on":
  push:
    branches:
      - [[ default_branch | to_json ]]
jobs:
  fixture:
    runs-on: ubuntu-24.04
    env:
      CADENCE_APP_PRIVATE_KEY: ${{ secrets.CADENCE_APP_PRIVATE_KEY }}
    steps:
      - run: [[ build_command | to_json ]]
      - run: [[ test_command | to_json ]]
""",
        )
        self.write(
            "template/.symphony.cfg.json.jinja",
            """{
  "schemaVersion": "symphony-repository/v1",
  "linear": {"teamKey": [[ linear_team_key | to_json ]]},
  "workingDirectory": ".",
  "instructions": [],
  "commands": {
    "build": [[ [["bash", "-lc", build_command]] | to_json ]],
    "test": [[ [["bash", "-lc", test_command]] | to_json ]]
  },
  "ci": {"requiredChecks": []}
}
""",
        )
        self.write(
            "template/apps.txt.jinja",
            "[% if symphony_app_slug != cadence_app_slug %]"
            "[[ symphony_app_slug ]]\n[[ cadence_app_slug ]]\n[% endif %]",
        )
        self.git("init", "--initial-branch=main")
        self.git("add", ".")
        self.git("-c", "user.name=Fixture", "-c", "user.email=fixture@example.invalid",
                 "-c", "commit.gpgsign=false", "commit", "-m", "Question fixture")
        self.commit = self.git("rev-parse", "HEAD").strip()
        self.git("branch", "alpha")

    def write(self, relative, content):
        path = self.source / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")

    def git(self, *args):
        return subprocess.check_output(
            ["git", "-C", str(self.source), *args], text=True, stderr=subprocess.STDOUT
        )

    def render(self, answers, name="output", ref="HEAD"):
        data_file = self.root / f"{name}-answers.yml"
        data_file.write_text(yaml.safe_dump(answers), encoding="utf-8")
        output = self.root / name
        result = subprocess.run(
            [sys.executable, "-m", "copier", "copy", "--defaults",
             f"--vcs-ref={ref}", "--data-file", str(data_file),
             str(self.source), str(output)],
            stdin=subprocess.DEVNULL, capture_output=True, text=True, timeout=30,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(self.git("status", "--porcelain"), "")
        return output

    def test_seven_answers_round_trip_without_root_assets(self):
        for index, (slug, branch, team) in enumerate([
            ("example/widget", "develop", "ENG"),
            ("another-owner/second-repo", "release/next", "OPS"),
        ]):
            with self.subTest(repo=slug):
                answers = {
                    "repo_slug": slug,
                    "default_branch": branch,
                    "linear_team_key": team,
                    "symphony_app_slug": f"author-{index}",
                    "cadence_app_slug": f"reviewer-{index}",
                    "build_command": f"printf '%s\\n' \"{slug}: build\"\nmake build\n",
                    "test_command": "printf '%s' 'quoted: \"test\"'\nmake test --flag='yes'\n",
                }
                output = self.render(answers, f"output-{index}", ref="alpha")
                saved = yaml.safe_load((output / ".copier-answers.yml").read_text())
                self.assertEqual(set(saved), QUESTIONS | {"_src_path", "_commit"})
                self.assertEqual({k: saved[k] for k in QUESTIONS}, answers)
                self.assertEqual(saved["_src_path"], str(self.source))
                # Copier uses Git's ordinary describe value, which can be abbreviated.
                self.assertEqual(self.git("rev-parse", saved["_commit"]).strip(), self.commit)

                workflow_text = (output / ".github/workflows/client.yml").read_text()
                self.assertIn(f"# Repository: {slug}\n", workflow_text)
                self.assertIn(GITHUB_SECRET, workflow_text)
                self.assertNotIn("[[", workflow_text)
                workflow = yaml.safe_load(workflow_text)
                self.assertEqual(workflow["name"], slug)
                self.assertEqual(workflow["on"]["push"]["branches"], [branch])
                job = workflow["jobs"]["fixture"]
                self.assertEqual(job["env"]["CADENCE_APP_PRIVATE_KEY"], GITHUB_SECRET)
                self.assertEqual(job["steps"], [
                    {"run": answers["build_command"]}, {"run": answers["test_command"]}
                ])
                config = json.loads((output / ".symphony.cfg.json").read_text())
                self.assertEqual(config["linear"], {"teamKey": team})
                for action in ("build", "test"):
                    self.assertEqual(config["commands"][action],
                                     [["bash", "-lc", answers[f"{action}_command"]]])
                self.assertEqual((output / "apps.txt").read_text(),
                                 f"author-{index}\nreviewer-{index}\n")
                files = {p.relative_to(output).as_posix() for p in output.rglob("*")
                         if p.is_file()}
                self.assertEqual(files, {".copier-answers.yml", ".symphony.cfg.json",
                                         ".github/workflows/client.yml", "apps.txt"})
                for relative in files:
                    content = (output / relative).read_text()
                    self.assertTrue(content.endswith("\n"), relative)
                    self.assertNotIn("ROOT-ONLY", content)

    def test_default_branch_and_ordinary_question_contract(self):
        configuration = yaml.safe_load((PACKAGE / "copier.yml").read_text())
        self.assertEqual({k for k in configuration if not k.startswith("_")}, QUESTIONS)
        self.assertNotIn("_tasks", configuration)
        self.assertNotIn("_vcs_ref", configuration)
        for question in QUESTIONS:
            self.assertEqual(configuration[question]["type"], "str")
        answers = {
            "repo_slug": "example/defaults", "linear_team_key": "100",
            "symphony_app_slug": "author", "cadence_app_slug": "reviewer",
            "build_command": "make build", "test_command": "make test",
        }
        output = self.render(answers)
        saved = yaml.safe_load((output / ".copier-answers.yml").read_text())
        self.assertEqual(saved["default_branch"], "main")
        self.assertEqual({k: saved[k] for k in answers}, answers)


if __name__ == "__main__":
    unittest.main()
