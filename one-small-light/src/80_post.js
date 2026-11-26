'use strict';
// ---- STAGE & LENS (three.js): the painted sheets, characters and lights are composited on the GPU, lit by the
// light map, then the whole frame goes through a watercolour pass: pigment pooling at edges, granulation in the
// paper's tooth, a slow turbulence in the wash, glow, the paper itself, and the border of the painted sheet.
const Stage = (() => {
  let R, scene, cam, rtScene, rtB0, rtB1, rtB2, rtB3, quadScene, quadCam, quad;
  const tex = {}, meshes = {}, over = {};
  const NOISE = /* glsl */`
    float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }`;
  const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
  const VSQ = 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const shared = { tLight: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uAmb: { value: new THREE.Vector3(1, 1, 1) }, uFogC: { value: new THREE.Vector3(1, 1, 1) }, uLG: { value: 1 } };
  const REVEAL = `float reveal(float r){ float n = fbm(gl_FragCoord.xy / 170.0); return smoothstep(n - 0.07, n + 0.07, r * 1.3 - 0.12); }`;

  function canvasTex(cv, flip) { const t = new THREE.CanvasTexture(cv); t.flipY = flip; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; return t; }
  function layerMat(L) {
    return new THREE.ShaderMaterial({
      vertexShader: VS, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      uniforms: Object.assign({ map: { value: canvasTex(L.canvas, false) }, emis: { value: L.emissive ? canvasTex(L.emissive, false) : null }, uHasE: { value: L.emissive ? 1 : 0 },
        uEmit: { value: 1 }, uLightK: { value: L.light }, uFog: { value: L.fog }, uRev: { value: 1 }, uOp: { value: 1 } }, shared),
      fragmentShader: NOISE + REVEAL + /* glsl */`
        uniform sampler2D map, emis, tLight; uniform float uHasE, uEmit, uLightK, uFog, uRev, uOp, uLG; uniform vec3 uAmb, uFogC; uniform vec2 uRes; varying vec2 vUv;
        void main(){ vec4 c = texture2D(map, vUv); if (c.a < 0.004) discard;
          vec3 L = texture2D(tLight, gl_FragCoord.xy / uRes).rgb;
          vec3 col = c.rgb * (uAmb + L * uLG * uLightK); col = mix(col, uFogC, uFog);
          if (uHasE > 0.5) { vec4 e = texture2D(emis, vUv); col = mix(col, e.rgb * uEmit, e.a * clamp(uEmit, 0.0, 1.0)); }
          gl_FragColor = vec4(col, c.a * reveal(uRev) * uOp); }`,
    });
  }
  // screen-sized canvas drawn over the frame: lit (actors) or added as light (glows)
  function screenMat(cv, mode) {
    const m = new THREE.ShaderMaterial({
      vertexShader: VSQ, transparent: true, depthTest: false, depthWrite: false,
      blending: mode === 'add' ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: Object.assign({ map: { value: canvasTex(cv, true) }, uLit: { value: mode === 'lit' ? 1 : 0 }, uRev: { value: 1 }, uOp: { value: 1 } }, shared),
      fragmentShader: NOISE + REVEAL + /* glsl */`
        uniform sampler2D map, tLight; uniform float uLit, uRev, uOp, uLG; uniform vec3 uAmb; uniform vec2 uRes; varying vec2 vUv;
        void main(){ vec2 s = gl_FragCoord.xy / uRes; vec4 c = texture2D(map, s); if (c.a < 0.003) discard;
          vec3 col = c.rgb; if (uLit > 0.5) col *= uAmb + min(texture2D(tLight, s).rgb * uLG * 0.7, vec3(0.75, 0.6, 0.45));
          gl_FragColor = vec4(col, c.a * reveal(uRev) * uOp); }`,
    });
    return m;
  }
  function screenQuad(mat, order) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)); const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = order; return m; }

  // ---- snow: three depths of falling flakes, lit by the same light map
  const SN = 900; let snow, snowSeed;
  function makeSnow() {
    const g = new THREE.BufferGeometry(), pos = new Float32Array(SN * 3), sz = new Float32Array(SN); snowSeed = [];
    const Rr = rng(301); for (let i = 0; i < SN; i++) { const d = i < 450 ? 0 : i < 780 ? 1 : 2; snowSeed.push({ x: Rr(), y: Rr(), d, sp: 0.7 + Rr() * 0.6, ph: Rr() * TAU, s: [2.2, 3.6, 6.5][d] * (0.7 + Rr() * 0.6) }); sz[i] = snowSeed[i].s; }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('size', new THREE.BufferAttribute(sz, 1));
    const m = new THREE.ShaderMaterial({ transparent: true, depthTest: false, depthWrite: false, uniforms: Object.assign({ uOp: { value: 1 } }, shared),
      vertexShader: 'attribute float size; void main(){ gl_PointSize = size; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform sampler2D tLight; uniform vec3 uAmb; uniform vec2 uRes; uniform float uOp, uLG;
        void main(){ vec2 q = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(q)); vec3 L = texture2D(tLight, gl_FragCoord.xy / uRes).rgb;
          gl_FragColor = vec4(vec3(0.97, 0.97, 1.0) * (uAmb * 0.8 + 0.28 + L * uLG * 0.8), a * 0.85 * uOp); }` });
    snow = new THREE.Points(g, m); snow.frustumCulled = false; snow.renderOrder = 20; return snow;
  }
  function updateSnow(t, c) {
    const p = snow.geometry.attributes.position.array, par = [0.55, 1.0, 1.6], spd = [38, 70, 130], z = c[2];
    for (let i = 0; i < SN; i++) {
      const s = snowSeed[i], d = s.d, zz = Math.pow(z, par[d]), wx = W / zz + 200, wy = H / zz + 200;
      let x = s.x * wx + Math.sin(t * 0.8 * s.sp + s.ph) * 18 - (c[0] * par[d]) + t * 14, y = s.y * wy + t * spd[d] * s.sp - c[1] * par[d];
      x = ((x % wx) + wx) % wx - 100; y = ((y % wy) + wy) % wy - 100;
      p[i * 3] = x * zz + (W - wx * zz) / 2 + 100 * zz; p[i * 3 + 1] = y * zz + (H - wy * zz) / 2 + 100 * zz; p[i * 3 + 2] = 0;
    }
    snow.geometry.attributes.position.needsUpdate = true;
  }

  // ---- post: bright pass, blur, and the watercolour finish
  const blurU = { tC: { value: null }, uDir: { value: new THREE.Vector2() } };
  let mBright, mBlur, mFin;
  const fin = { tC: { value: null }, tB1: { value: null }, tB2: { value: null }, uRes: { value: new THREE.Vector2(W, H) }, uTime: { value: 0 }, uBorder: { value: 0 }, uSheet: { value: 0 }, uFade: { value: 0 }, uVig: { value: 0.32 }, uBloom: { value: 1 } };
  function postMats() {
    const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VSQ, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    mBright = mk(`uniform sampler2D tC; varying vec2 vUv; void main(){ vec3 c = texture2D(tC, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(0.98, 1.8, l), 1.0); }`, { tC: { value: null } });
    mBlur = mk(`uniform sampler2D tC; uniform vec2 uDir; varying vec2 vUv; void main(){ vec3 s = texture2D(tC, vUv).rgb * 0.227;
      s += (texture2D(tC, vUv + uDir * 1.385).rgb + texture2D(tC, vUv - uDir * 1.385).rgb) * 0.316; s += (texture2D(tC, vUv + uDir * 3.23).rgb + texture2D(tC, vUv - uDir * 3.23).rgb) * 0.07; gl_FragColor = vec4(s, 1.0); }`, blurU);
    mFin = mk(NOISE + /* glsl */`
      uniform sampler2D tC, tB1, tB2; uniform vec2 uRes; uniform float uTime, uBorder, uSheet, uFade, uVig, uBloom; varying vec2 vUv;
      void main(){
        vec2 px = vUv * uRes; float sc = uRes.y / 1080.0;
        // the paper holds the paint unevenly: a slow, fixed warp of the wash
        vec2 w = vec2(fbm(px / (80.0 * sc)), fbm(px / (80.0 * sc) + 9.3)) - 0.5;
        vec2 uv = vUv + w * 2.6 * sc / uRes;
        vec3 c0 = texture2D(tC, uv).rgb, c = clamp(c0, 0.0, 1.0);
        // edge darkening: where a wash meets a different one, pigment pools at the rim
        vec3 avg = vec3(0.0); for (int i = 0; i < 8; i++){ float a = float(i) * 0.785398; avg += clamp(texture2D(tC, uv + vec2(cos(a), sin(a)) * 2.2 * sc / uRes).rgb, 0.0, 1.0); } avg /= 8.0;
        float edge = clamp(length(avg - c) * 2.4, 0.0, 1.0);
        // pigment density: turbulence (big soft blooms) + granulation (pigment settling in the tooth) + edge pooling
        float turb = fbm(px / (240.0 * sc)) - 0.5, gran = vnoise(px / (3.0 * sc)) * 0.4 + vnoise(px / (9.0 * sc)) * 0.6 - 0.5;
        float d = 1.0 + turb * (0.42 + 0.2 * uSheet) + gran * (0.12 + 0.2 * uSheet) + edge * 0.6;
        c = clamp(c - (c - c * c) * (d - 1.0) * 1.6, 0.0, 1.0);
        // light that was brighter than paint (lamps, bulbs) keeps its heat, and glows
        c += max(c0 - 1.0, 0.0) * 0.5 + (texture2D(tB1, vUv).rgb * 0.55 + texture2D(tB2, vUv).rgb * 0.6) * uBloom;
        // the paper: cold-press tooth and a few long fibres
        float tooth = vnoise(px / (2.4 * sc)) * 0.5 + vnoise(px / (7.0 * sc)) * 0.3 + fbm(px / (60.0 * sc)) * 0.2;
        float fibre = smoothstep(0.78, 0.95, vnoise(vec2(px.x / (40.0 * sc), px.y / (2.5 * sc)) + 3.0)) * 0.5;
        vec3 paper = vec3(0.972, 0.945, 0.89);
        c *= mix(vec3(1.0), paper * (0.965 + 0.045 * tooth - 0.03 * fibre) / 0.972, 0.75);
        // grade: lift the blacks toward ink-blue, a soft vignette
        c = mix(vec3(0.07, 0.08, 0.16), vec3(1.0), c) * 1.0;
        vec2 q = vUv - 0.5; c *= 1.0 - uVig * dot(q * vec2(1.1, 1.0), q * vec2(1.1, 1.0)) * 1.6;
        // the painted sheet: a deckled paper margin and a thin vermilion rule, coming in and out
        vec3 paperS = paper * (0.97 + 0.05 * tooth);
        if (uBorder > 0.001) { float m = 44.0 * sc * uBorder, wv = (vnoise(px / (46.0 * sc)) - 0.5) * 7.0 * sc + (vnoise(px / (7.0 * sc)) - 0.5) * 2.5 * sc;
          vec2 e2 = min(px, uRes - px); float ed = min(e2.x, e2.y) + wv;
          c = mix(c, paperS, smoothstep(m + 3.0 * sc, m - 1.0 * sc, ed) * smoothstep(0.0, 0.1, uBorder));
          c = mix(c, vec3(0.74, 0.29, 0.2), smoothstep(1.7 * sc, 0.5 * sc, abs(ed - m - 12.0 * sc)) * 0.75 * smoothstep(0.6, 1.0, uBorder)); }
        c = mix(c, paperS, uFade);
        c += (h21(px + fract(uTime * 7.31) * 91.7) - 0.5) * 0.018;
        gl_FragColor = vec4(c, 1.0); }`, fin);
  }

  function init(canvas, A, preserve) {
    R = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: !!preserve, powerPreference: 'high-performance' });
    R.setPixelRatio(1); R.setSize(W, H, false); R.outputColorSpace = THREE.LinearSRGBColorSpace; R.toneMapping = THREE.NoToneMapping; R.autoClear = true;
    R.setClearColor(new THREE.Color(0.972, 0.945, 0.89), 1);
    scene = new THREE.Scene(); cam = new THREE.OrthographicCamera(0, W, 0, H, -10, 10); cam.position.z = 5;
    const opt = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    rtScene = new THREE.WebGLRenderTarget(W, H, opt); rtB0 = new THREE.WebGLRenderTarget(W / 4, H / 4, opt); rtB1 = new THREE.WebGLRenderTarget(W / 4, H / 4, opt);
    rtB2 = new THREE.WebGLRenderTarget(W / 8, H / 8, opt); rtB3 = new THREE.WebGLRenderTarget(W / 8, H / 8, opt);
    tex.light = canvasTex(A.light.canvas, true); shared.tLight.value = tex.light;
    // sky
    meshes.sky = screenQuad(new THREE.ShaderMaterial({ vertexShader: VSQ, depthTest: false, depthWrite: false, transparent: true,
      uniforms: Object.assign({ uTop: { value: new THREE.Vector3() }, uMid: { value: new THREE.Vector3() }, uHor: { value: new THREE.Vector3() }, uSun: { value: 1 }, uRev: { value: 1 }, uOff: { value: 0 } }, shared),
      fragmentShader: NOISE + REVEAL + /* glsl */`uniform vec3 uTop, uMid, uHor; uniform float uSun, uRev, uOff; uniform vec2 uRes; varying vec2 vUv;
        void main(){ vec2 px = gl_FragCoord.xy; float v = vUv.y + uOff + (fbm(px / 420.0) - 0.5) * 0.12;
          vec3 c = mix(uHor, uMid, smoothstep(0.2, 0.62, v)); c = mix(c, uTop, smoothstep(0.55, 1.05, v));
          c *= 0.95 + 0.09 * fbm(px / 260.0 + 4.0);
          vec2 sp = (px - vec2(180.0, 380.0)) / vec2(900.0, 420.0); c += vec3(1.0, 0.62, 0.38) * exp(-dot(sp, sp) * 2.0) * 0.22 * uSun;
          gl_FragColor = vec4(c, reveal(uRev)); }` }), 0);
    scene.add(meshes.sky);
    meshes.skyfx = screenQuad(screenMat(A.sky.canvas, 'add'), 1); scene.add(meshes.skyfx);
    World.LAYERS.forEach((L, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), layerMat(L)); m.renderOrder = [2, 3, 4, 5, 6, 7, 12][i]; m.frustumCulled = false; meshes[L.id] = m; scene.add(m); });
    meshes.back = screenQuad(screenMat(A.back.canvas, 'add'), 8); scene.add(meshes.back);
    meshes.actors = screenQuad(screenMat(A.actors.canvas, 'lit'), 9); scene.add(meshes.actors);
    meshes.front = screenQuad(screenMat(A.front.canvas, 'add'), 10); scene.add(meshes.front);
    scene.add(makeSnow());
    const T = Titles.build();
    for (const k of ['title', 'greet', 'seal']) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(T[k].width, T[k].height), new THREE.MeshBasicMaterial({ map: canvasTex(T[k], false), transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide, opacity: 0 }));
      m.renderOrder = 30; m.frustumCulled = false; over[k] = m; scene.add(m);
    }
    postMats();
    quad = screenQuad(mBright, 0); quadScene = new THREE.Scene(); quadScene.add(quad); quadCam = new THREE.Camera();
  }
  const pass = (mat, target) => { quad.material = mat; R.setRenderTarget(target); R.render(quadScene, quadCam); };

  function render(t, c, F, A) {
    // time of day
    const sk = Story.sky(t), amb = Story.ambient(t), boost = F.treeGlow * 0.06;
    shared.uAmb.value.set(amb[0] + boost * 1.2, amb[1] + boost, amb[2] + boost * 0.6); shared.uLG.value = lerp(0.35, 1.9, clamp(Story.mood(t) / 2)); shared.uFogC.value.set(...sk.hor);
    const su = meshes.sky.material.uniforms; su.uTop.value.set(...sk.top); su.uMid.value.set(...sk.mid); su.uHor.value.set(...sk.hor); su.uSun.value = 1 - smooth(6, 11, t); su.uOff.value = (c[1] - 1060) * 0.00012;
    // bar 1: four washes on four chimes
    const wash = k => { const a = Score.since('wash', k, t); return a === Infinity ? 0 : ease.out(clamp(a / 0.9)); };
    const rev = { clouds: 0, far: 0, hills: 1, village: 1, mid: 1, main: 2, fore: 3 };
    su.uRev.value = wash(0);
    for (const L of World.LAYERS) {
      const m = meshes[L.id], v = World.view(L, c), w = L.ex[2] - L.ex[0], h = L.ex[3] - L.ex[1];
      m.scale.set(w * v.z, h * v.z, 1); m.position.set((L.ex[0] + w / 2 - v.ox) * v.z + W / 2, (L.ex[1] + h / 2 - v.oy) * v.z + H / 2, 0);
      m.material.uniforms.uRev.value = wash(rev[L.id]);
      if (L.emissive) m.material.uniforms.uEmit.value = 0.75 + 0.55 * smooth(6, 13, t);
    }
    meshes.skyfx.material.uniforms.uRev.value = wash(0);
    for (const k of ['actors', 'front']) meshes[k].material.uniforms.uRev.value = wash(3);
    // snow starts as the sheet comes alive
    updateSnow(t, c); snow.material.uniforms.uOp.value = smooth(2.5, 3.6, t) * (1 - smooth(29.2, 29.9, t));
    // titles
    const st = Titles.state(t);
    for (const k of ['title', 'greet', 'seal']) { const [x, y, o] = st[k]; over[k].position.set(x, y, 0); over[k].material.opacity = clamp(o); }
    const sa = t - at(12, 3); over.seal.scale.setScalar(sa > 0 && sa < 0.2 ? 1 + 0.35 * (1 - ease.out(sa / 0.2)) : 1);
    // canvases -> GPU
    for (const k of ['actors', 'back', 'front', 'skyfx']) meshes[k].material.uniforms.map.value.needsUpdate = true;
    tex.light.needsUpdate = true;
    // draw the stage, then the lens
    R.setRenderTarget(rtScene); R.clear(); R.render(scene, cam);
    mBright.uniforms.tC.value = rtScene.texture; pass(mBright, rtB0);
    blurU.tC.value = rtB0.texture; blurU.uDir.value.set(1.5 / (W / 4), 0); pass(mBlur, rtB1);
    blurU.tC.value = rtB1.texture; blurU.uDir.value.set(0, 1.5 / (H / 4)); pass(mBlur, rtB0);
    blurU.tC.value = rtB0.texture; blurU.uDir.value.set(2 / (W / 8), 0); pass(mBlur, rtB2);
    blurU.tC.value = rtB2.texture; blurU.uDir.value.set(0, 2 / (H / 8)); pass(mBlur, rtB3);
    fin.tC.value = rtScene.texture; fin.tB1.value = rtB0.texture; fin.tB2.value = rtB3.texture; fin.uTime.value = t;
    fin.uBorder.value = Math.max(1 - smooth(2.5, 3.7, t), smooth(27.6, 28.6, t));
    fin.uSheet.value = fin.uBorder.value; fin.uFade.value = smooth(29.45, 30, t);
    pass(mFin, null);
  }
  return { init, render, get renderer() { return R; } };
})();
