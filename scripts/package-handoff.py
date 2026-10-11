"""Package the committed source and prebuilt AWS artifacts without private files.

Run all checks and web/API/voice builds, commit the readable source, then run:
    python3 scripts/package-handoff.py
This script does not deploy, provision, call, charge or install private tooling.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

root = Path(__file__).resolve().parent.parent
app = root / "apps/revenuerescue"
out = root / "integrated"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)


if git("status", "--porcelain", "--", ".", ":(exclude)integrated").strip():
    raise SystemExit("Commit readable source before packaging.")
commit = git("rev-parse", "HEAD").decode().strip()
paths = [p for p in git("ls-tree", "-r", "--name-only", "HEAD").decode().splitlines()
         if not p.startswith("integrated/")]
for name in paths:
    parts = Path(name).parts
    if any(p in {"node_modules", ".local", ".data", ".aws", ".npmrc"}
           or (p.startswith(".env") and p != ".env.example") for p in parts):
        raise SystemExit("Refusing private or dependency path: " + name)

out.mkdir(exist_ok=True)
source = out / "relay-source.zip"
source.write_bytes(git("archive", "--format=zip", "--prefix=relay-source/", "HEAD", "--", *paths))
source_manifest = {
    "sourceCommit": commit,
    "fileCount": len(paths),
    "scope": "Complete tracked source, tests, configuration examples, documentation and core infrastructure. Generated archives, dependencies and private runtime configuration excluded.",
    "archiveSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
}
(out / "source-manifest.json").write_text(json.dumps(source_manifest, indent=2) + "\n")

manifest = {
    "sourceCommit": commit,
    "scope": "Current static website, API and voice Lambda artifacts; requires existing AWS infrastructure and private configuration. Subscription offer is visible; checkout is not connected. No standalone Next.js server in this archive.",
}
archive = out / "relay-sample-voice-aws.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as z:
    for path in sorted((app / ".local/relay-web").iterdir()):
        if path.is_file():
            z.write(path, "website/" + path.name)
    z.write(app / ".local/lambda/function.zip", "api/function.zip")
    z.write(app / ".local/voice/function.zip", "voice/function.zip")
    for name in ["TEAM_HANDOFF.md", "website-phone-control.md", "sample-schedule.md", "subscription-plan.md"]:
        z.write(root / "docs" / name, "docs/" + name)
    z.writestr("manifest.json", json.dumps(manifest, indent=2) + "\n")
    z.writestr("README.txt", "Read docs/TEAM_HANDOFF.md. No credentials included. Installation does not schedule calls or enable payment. Source is separately available in relay-source.zip.\n")
manifest["archiveSha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
(out / "sample-voice-manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Packaged {len(paths)} source files and AWS artifacts from {commit}.")
