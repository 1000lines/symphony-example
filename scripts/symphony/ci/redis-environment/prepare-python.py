"""Resolve once, then prove an offline, hash-checked interpreter/parser replay."""

import hashlib
import json
import os
from pathlib import Path
import platform
import subprocess
import sys
import zipfile
from email.parser import BytesParser


def run(*args):
    subprocess.run(args, check=True)


root = Path("/work")
wheels = root / "wheels"
wheels.mkdir(exist_ok=True)
os.environ.update(PIP_CONFIG_FILE="/dev/null", PIP_DISABLE_PIP_VERSION_CHECK="1",
                  PIP_INDEX_URL="https://pypi.org/simple", HOME="/work/home")
run(sys.executable, "-m", "venv", "/work/venv")
python = "/work/venv/bin/python"
parser = sys.argv[1]
assert parser in ("plain", "hiredis-old", "hiredis-new")
if not (root / "requirements.lock").exists():
    bootstrap = root / "bootstrap.constraints"
    bootstrap.write_text("pip==25.3\nsetuptools==80.9.0\nwheel==0.45.1\nhatchling==1.27.0\neditables==0.5\n")
    os.environ["PIP_CONSTRAINT"] = str(bootstrap)
    packages = ["pip", "setuptools", "wheel", "hatchling", "editables", ".[jwt]"]
    if parser != "plain":
        packages.append("hiredis<3.0.0" if parser == "hiredis-old" else "hiredis>=3.2.0")
    run(python, "-m", "pip", "wheel", "--wheel-dir", str(wheels),
        "-r", "dev_requirements.txt", *packages)
    requirements = []
    constraints = []
    artifacts = {}
    for file in sorted(wheels.glob("*.whl")):
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        with zipfile.ZipFile(file) as archive:
            metadata_path = next(p for p in archive.namelist() if p.endswith(".dist-info/METADATA"))
            metadata = BytesParser().parsebytes(archive.read(metadata_path))
        pin = f'{metadata["Name"]}=={metadata["Version"]}'
        requirements.append(f"{pin} --hash=sha256:{digest}")
        # Redis is deliberately uninstalled before the editable source install.
        if metadata["Name"].lower() != "redis":
            constraints.append(pin)
        artifacts[file.name] = digest
    (root / "requirements.lock").write_text("\n".join(requirements) + "\n")
    (root / "constraints.txt").write_text("\n".join(constraints) + "\n")
    (root / "wheels.json").write_text(json.dumps(artifacts, indent=2) + "\n")

for name, digest in json.loads((root / "wheels.json").read_text()).items():
    assert Path(name).name == name and name.endswith(".whl")
    assert hashlib.sha256((wheels / name).read_bytes()).hexdigest() == digest, name
os.environ.update(PIP_NO_INDEX="1", PIP_FIND_LINKS=str(wheels),
                  PIP_CONSTRAINT="/work/constraints.txt",
                  PIP_BUILD_CONSTRAINT="/work/constraints.txt")
run(python, "-m", "pip", "install", "--require-hashes", "-r", "/work/requirements.lock")
run(python, "-m", "pip", "uninstall", "-y", "redis")
run(python, "-m", "pip", "install", "-e", ".[jwt]")
run(python, "-m", "pip", "check")
# New venv + pip upgrade + isolated build reproduce the package script's nested installs.
run(python, "-m", "venv", "/work/nested")
run("/work/nested/bin/python", "-m", "pip", "install", "--upgrade", "pip")
run("/work/nested/bin/python", "-m", "pip", "install", "-r", "dev_requirements.txt", "hatchling")
run("/work/nested/bin/python", "-m", "build", ".", "--outdir", "/work/package-probe")
installed = json.loads(subprocess.check_output([python, "-m", "pip", "list", "--format=json"]))
run(python, "--version")
run(python, "-m", "pip", "--version")
(root / "freeze.txt").write_bytes(subprocess.check_output([python, "-m", "pip", "freeze", "--all"]))
run(python, "-c", "import redis, numpy, ujson, uvloop" if platform.python_implementation() == "CPython" else "import redis, numpy, ujson")
if parser != "plain":
    run(python, "-c", "import hiredis; r=hiredis.Reader(); r.feed(b'+OK\\r\\n'); assert r.gets()==b'OK'")
else:
    assert not any(p["name"].lower() == "hiredis" for p in installed)
actual_parser = subprocess.check_output([python, "-c", "import redis; print(type(redis.Connection()._parser).__name__)"], text=True).strip()
(root / "python.json").write_text(json.dumps({
    "version": sys.version, "implementation": platform.python_implementation(),
    "uid": os.getuid(), "gid": os.getgid(), "parser": parser, "packages": installed,
    "offlineReplay": True, "nestedBuild": True, "actualParser": actual_parser,
}, indent=2) + "\n")
