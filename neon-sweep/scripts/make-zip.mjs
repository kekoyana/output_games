#!/usr/bin/env node
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { dirname, basename } from "path";

const root = dirname(dirname(new URL(import.meta.url).pathname));
process.chdir(root);

const gameName = basename(root);
const zipName = `${gameName}.zip`;

// Build
execSync("npx tsc && npx vite build", { stdio: "inherit" });

// Create zip via temporary python script
const pyFile = "_make_zip.py";
writeFileSync(
  pyFile,
  `import zipfile, os
with zipfile.ZipFile(${JSON.stringify(zipName)}, 'w', zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk('dist'):
        for f in files:
            filepath = os.path.join(root, f)
            arcname = os.path.join(${JSON.stringify(gameName)}, os.path.relpath(filepath, 'dist'))
            zf.write(filepath, arcname)
print('Created ' + ${JSON.stringify(zipName)})
`
);

try {
  execSync(`python3 ${pyFile}`, { stdio: "inherit" });
} finally {
  unlinkSync(pyFile);
}
