#!/usr/bin/env python3
"""Inline three.js + src/*.js (in name order) into ONE html file: index.html.  Usage: python3 tools/build.py"""
import glob, os, re, subprocess, sys, tempfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); SRC = os.path.join(ROOT, "src"); V = os.path.join(ROOT, "vendor")
OUT = os.path.join(ROOT, "index.html")
core = open(os.path.join(V, "three.core.min.js")).read(); mod = open(os.path.join(V, "three.module.min.js")).read()
def pairs(body):
    out = []
    for it in body.split(","):
        it = it.strip()
        if not it: continue
        if " as " in it: x, y = [q.strip() for q in it.split(" as ")]; out.append((x, y))
        else: out.append((it, it))
    return out
# three.js ships as two ES modules; rewrite them into one plain script that defines a global THREE
mc = re.search(r'export\s*\{([^}]*)\}\s*;?\s*$', core.strip()); core_body = core.strip()[:mc.start()]; core_exports = pairs(mc.group(1))
mi = re.search(r'import\s*\{([^}]*)\}\s*from\s*"\./three\.core\.min\.js"\s*;?', mod); imports = pairs(mi.group(1))
reexp = re.search(r'export\s*\{([^}]*)\}\s*from\s*"\./three\.core\.min\.js"\s*;?', mod)
mod_body = mod.replace(mi.group(0), "", 1)
if reexp: mod_body = mod_body.replace(reexp.group(0), "", 1)
mo = re.search(r'export\s*\{([^}]*)\}\s*;?\s*$', mod_body.strip()); own = pairs(mo.group(1)); mod_body = mod_body.strip()[:mo.start()]
reexported = [n for _, n in pairs(reexp.group(1))] if reexp else []
three = ("var THREE=(function(){'use strict';var __core=(function(){'use strict';" + core_body + ";return{" + ",".join(f"{n}:{l}" for l, n in core_exports) + "};})();" +
  "var __mod=(function(__core){'use strict';var{" + ",".join(f"{n}:{l}" for n, l in imports) + "}=__core;" + mod_body +
  ";return{" + ",".join([f"{n}:__core.{n}" for n in reexported] + [f"{n}:{l}" for l, n in own]) + "};})(__core);return Object.freeze(Object.assign({},__core,__mod));})();")
app = []
for f in sorted(glob.glob(os.path.join(SRC, "*.js"))):
    src = open(f).read(); assert "</script" not in src.lower(), f
    r = subprocess.run(["node", "--check", f], capture_output=True, text=True)
    if r.returncode != 0: print(f"SYNTAX ERROR in {os.path.basename(f)}:\n{r.stderr.strip()[:900]}"); sys.exit(1)
    app.append(f"// ===== {os.path.basename(f)} =====\n" + src.replace("'use strict';", "", 1))
joined = "'use strict';\n" + "\n".join(app)
with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tf: tf.write(joined)
r = subprocess.run(["node", "--check", tf.name], capture_output=True, text=True); os.unlink(tf.name)
if r.returncode != 0: print("SYNTAX ERROR in the joined app:\n" + r.stderr.strip()[:1500]); sys.exit(1)
out = open(os.path.join(SRC, "shell.html")).read()
out = out.replace("{{THREE}}", three).replace("{{APP}}", joined)
open(OUT, "w").write(out)
print(f"built {os.path.relpath(OUT, ROOT)} {len(out)/1024:.0f} KB ({len(app)} modules)")
