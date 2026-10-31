/**
 * AegisHarness - 3D Technical Motion Artifacts
 * Swiss Editorial Security Research x Premium Interactive 3D Product Design
 *
 * Implements 5 coherent 3D technical exhibits:
 * 1. The Aegis Policy Boundary (Hero Section)
 * 2. The Corporate Asset Vault (Company Zone)
 * 3. The Adversarial Signal Field (Red Zone)
 * 4. The Deterministic Policy Gate (Target Zone)
 * 5. The Immutable Ledger Structure (Audit Ledger)
 */

(function () {
  'use strict';

  // Strict Aegis Color Palette
  const PALETTE = {
    bg: 0xFAF8F5,
    bgAlt: 0xF4EFE6,
    charcoal: 0x1A1A1A,
    charcoalDark: 0x111111,
    border: 0xD9D0C1,
    borderDark: 0x8C827A,
    red: 0xB23A22,       // Aegis Red (adversarial / denial)
    sage: 0x1E653A,      // Forest Sage (verified / permitted)
    slate: 0x3A5A78,     // Enterprise Slate Blue (vault data)
    cream: 0xF4EFE6,     // Ivory Cream
    lineMuted: 0xC4BCB0, // Subtle hairwire grid
  };

  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Helper: Create a lightweight Three.js setup
  function createSceneSetup(canvas, container, fov = 35) {
    if (!canvas || !container || typeof THREE === 'undefined') return null;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 380;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } catch (e) {
      console.warn('[Aegis 3D] WebGL not supported on canvas:', canvas.id, e);
      return null;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 100);
    camera.position.z = 7.0;

    // Studio lighting (restrained, technical, clean)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight1.position.set(4, 6, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xFAF8F5, 0.4);
    dirLight2.position.set(-4, -3, -2);
    scene.add(dirLight2);

    return { renderer, scene, camera, width, height };
  }

  // =========================================================================
  // ARTIFACT 1: HERO - THE AEGIS POLICY BOUNDARY
  // =========================================================================
  function initHeroPolicyBoundary() {
    const stage = document.getElementById('hero-3d-stage');
    const canvas = document.getElementById('hero-3d-canvas');
    if (!stage || !canvas) return;

    const setup = createSceneSetup(canvas, stage, 34);
    if (!setup) return;
    const { renderer, scene, camera } = setup;
    camera.position.z = 7.2;

    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    // 1. Central Protected Core (Small Geometric Monolith / Cube)
    const coreGeo = new THREE.BoxGeometry(0.85, 1.15, 0.85);
    const coreMat = new THREE.MeshStandardMaterial({
      color: PALETTE.charcoalDark,
      roughness: 0.25,
      metalness: 0.8,
    });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    rootGroup.add(coreMesh);

    // Bevel seam wireframe for core
    const coreEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(coreGeo),
      new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 1 })
    );
    coreMesh.add(coreEdges);

    // 2. Outer Containment Boundary (Architectural Wireframe Dodecahedron)
    const outerGeo = new THREE.DodecahedronGeometry(2.35, 0);
    const outerEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(outerGeo),
      new THREE.LineBasicMaterial({ color: PALETTE.charcoal, transparent: true, opacity: 0.65 })
    );
    rootGroup.add(outerEdges);

    // Translucent facets
    const outerFacets = new THREE.Mesh(
      outerGeo,
      new THREE.MeshBasicMaterial({
        color: PALETTE.bgAlt,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
      })
    );
    rootGroup.add(outerFacets);

    // 3. Multiple Boundary Layers
    // Layer 1: Inner Octahedron Wireframe
    const innerGeo = new THREE.OctahedronGeometry(1.55, 0);
    const innerEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(innerGeo),
      new THREE.LineBasicMaterial({ color: PALETTE.borderDark, transparent: true, opacity: 0.45 })
    );
    rootGroup.add(innerEdges);

    // Layer 2: Equatorial Horizon Coordinate Ring
    const ringGeo = new THREE.RingGeometry(1.95, 2.0, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: PALETTE.borderDark,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 2.3;
    rootGroup.add(ringMesh);

    // 4. Policy Checkpoints (Precise nodes on boundary vertices)
    const checkpointNodes = [];
    const nodeGeo = new THREE.OctahedronGeometry(0.075, 0);
    const nodePos = outerGeo.attributes.position;
    const addedPoints = new Set();

    for (let i = 0; i < nodePos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(nodePos, i);
      const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
      if (!addedPoints.has(key)) {
        addedPoints.add(key);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
        const node = new THREE.Mesh(nodeGeo, nodeMat);
        node.position.copy(v);
        rootGroup.add(node);
        checkpointNodes.push({ mesh: node, baseColor: 0x555555, pulse: 0 });
      }
    }

    // 5. Incoming Signal Particles (Aegis Red / Orange)
    const PARTICLE_COUNT = 18;
    const particles = [];
    const pGeo = new THREE.OctahedronGeometry(0.045, 0);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pMat = new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.9 });
      const pMesh = new THREE.Mesh(pGeo, pMat);
      rootGroup.add(pMesh);

      // Random starting direction in untrusted outer space
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.sin(phi) * Math.sin(theta),
        Math.cos(phi)
      ).normalize();

      particles.push({
        mesh: pMesh,
        dir: dir,
        dist: 3.8 + Math.random() * 1.5,
        speed: 0.012 + Math.random() * 0.008,
        deflecting: false,
        deflectVec: new THREE.Vector3(),
        opacity: 0.9,
      });
    }

    // Mouse & Inertia Interaction
    let isDragging = false, lastX = 0, lastY = 0, lastTime = 0;
    let vx = 0, vy = 0;
    let mouseParallaxX = 0, mouseParallaxY = 0;
    let isVisible = true;

    stage.addEventListener('pointerdown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = performance.now();
      vx = vy = 0;
      stage.setPointerCapture(e.pointerId);
    });

    stage.addEventListener('pointermove', (e) => {
      const rect = stage.getBoundingClientRect();
      mouseParallaxX = ((e.clientX - rect.left) / rect.width - 0.5) * 0.6;
      mouseParallaxY = ((e.clientY - rect.top) / rect.height - 0.5) * 0.4;

      if (!isDragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastTime);
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      lastTime = now;

      rootGroup.rotation.y += dx * 0.006;
      rootGroup.rotation.x += dy * 0.006;
      vx = (dx / dt) * 12;
      vy = (dy / dt) * 12;
    });

    const stopDrag = () => { isDragging = false; };
    stage.addEventListener('pointerup', stopDrag);
    stage.addEventListener('pointercancel', stopDrag);

    // Resize handler
    const onResize = () => {
      if (!stage.clientWidth || !stage.clientHeight) return;
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    };
    window.addEventListener('resize', onResize);

    // Animation Loop
    let clock = new THREE.Clock();
    let shellPulse = 0;

    function renderFrame() {
      if (!isVisible) return;
      requestAnimationFrame(renderFrame);

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      if (!REDUCED_MOTION) {
        // Inertia or slow precise engineered rotation
        if (isDragging) {
          // Handled in pointermove
        } else {
          rootGroup.rotation.y += (vx * delta * 0.06) + 0.0025;
          rootGroup.rotation.x += (vy * delta * 0.06);
          vx *= 0.94;
          vy *= 0.94;

          // Camera gentle parallax lerp
          camera.position.x += (mouseParallaxX - camera.position.x) * 0.05;
          camera.position.y += (-mouseParallaxY - camera.position.y) * 0.05;
          camera.lookAt(0, 0, 0);

          // Independent layer rotations
          innerEdges.rotation.y = time * 0.06;
          innerEdges.rotation.x = Math.sin(time * 0.3) * 0.1;

          ringMesh.rotation.z = time * 0.04;
          coreMesh.position.y = Math.sin(time * 1.2) * 0.04;
          coreMesh.rotation.y = -time * 0.08;
        }

        // Particle dynamics & boundary deflection
        particles.forEach((p) => {
          if (!p.deflecting) {
            p.dist -= p.speed;
            p.mesh.position.copy(p.dir).multiplyScalar(p.dist);

            // Check boundary collision (radius ~ 2.35)
            if (p.dist <= 2.35) {
              p.deflecting = true;
              shellPulse = 1.0;

              // Find closest checkpoint node and pulse it
              let closest = checkpointNodes[0], minDist = Infinity;
              checkpointNodes.forEach((cn) => {
                const d = cn.mesh.position.distanceTo(p.mesh.position);
                if (d < minDist) { minDist = d; closest = cn; }
              });
              if (closest) closest.pulse = 1.0;

              // Deterministic tangential deflection vector
              p.deflectVec.copy(p.dir).cross(new THREE.Vector3(0, 1, 0)).normalize();
              if (Math.random() > 0.5) p.deflectVec.negate();
              p.deflectVec.add(p.dir.clone().multiplyScalar(0.4)).normalize();
            }
          } else {
            // Deflection / dissolving path
            p.mesh.position.addScaledVector(p.deflectVec, p.speed * 1.5);
            p.opacity -= delta * 1.8;
            p.mesh.material.opacity = Math.max(0, p.opacity);

            if (p.opacity <= 0) {
              // Reset particle back in outer untrusted space
              const theta = Math.random() * Math.PI * 2;
              const phi = Math.acos(Math.random() * 2 - 1);
              p.dir.set(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
              ).normalize();
              p.dist = 4.2 + Math.random() * 1.2;
              p.opacity = 0.9;
              p.mesh.material.opacity = 0.9;
              p.deflecting = false;
            }
          }
        });

        // Decay checkpoint node pulses
        checkpointNodes.forEach((cn) => {
          if (cn.pulse > 0) {
            cn.pulse = Math.max(0, cn.pulse - delta * 3.0);
            cn.mesh.material.color.setHex(cn.pulse > 0.1 ? PALETTE.red : cn.baseColor);
          }
        });

        // Shell deflection shimmer
        if (shellPulse > 0) {
          shellPulse = Math.max(0, shellPulse - delta * 2.5);
          outerEdges.material.opacity = 0.65 + shellPulse * 0.3;
        }
      }

      renderer.render(scene, camera);
    }

    // IntersectionObserver to pause rendering when off-screen
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) { clock.getDelta(); renderFrame(); }
      }, { threshold: 0.1 });
      io.observe(stage);
    }

    renderFrame();
  }

  // =========================================================================
  // ARTIFACT 2: SECTION 01 - THE CORPORATE ASSET VAULT
  // =========================================================================
  function initAssetVaultArtifact() {
    const stage = document.getElementById('stage-vault');
    const canvas = document.getElementById('canvas-vault');
    if (!stage || !canvas) return;

    const setup = createSceneSetup(canvas, stage, 32);
    if (!setup) return;
    const { renderer, scene, camera } = setup;
    camera.position.set(0, 0.4, 6.8);

    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);

    // 1. Transparent Architectural Vitrine / Enclosure
    const cageGeo = new THREE.BoxGeometry(2.7, 3.6, 2.7);
    const cageEdges = new THREE.LineSegments(
      new THREE.EdgesGeometry(cageGeo),
      new THREE.LineBasicMaterial({ color: PALETTE.charcoal, transparent: true, opacity: 0.45 })
    );
    vaultGroup.add(cageEdges);

    // Corner datum brackets
    const bracketGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
    const bracketMat = new THREE.MeshBasicMaterial({ color: PALETTE.borderDark });
    [[-1.35, -1.8, -1.35], [1.35, -1.8, -1.35], [-1.35, 1.8, -1.35], [1.35, 1.8, -1.35],
     [-1.35, -1.8, 1.35], [1.35, -1.8, 1.35], [-1.35, 1.8, 1.35], [1.35, 1.8, 1.35]].forEach((pos) => {
      const b = new THREE.Mesh(bracketGeo, bracketMat);
      b.position.set(...pos);
      vaultGroup.add(b);
    });

    // 2. Stacked Database Cylinders (Minimal Architectural Platters)
    const cylGroup = new THREE.Group();
    vaultGroup.add(cylGroup);

    const cylGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.3, 40);
    const cylMatCream = new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      roughness: 0.35,
      metalness: 0.15,
    });
    const cylMatSlate = new THREE.MeshStandardMaterial({
      color: PALETTE.slate,
      roughness: 0.3,
      metalness: 0.25,
    });

    // Bottom disk
    const disk1 = new THREE.Mesh(cylGeo, cylMatCream);
    disk1.position.y = -0.45;
    cylGroup.add(disk1);

    // Middle disk (FCA enterprise slate band)
    const disk2 = new THREE.Mesh(cylGeo, cylMatSlate);
    disk2.position.y = 0;
    cylGroup.add(disk2);

    // Top disk
    const disk3 = new THREE.Mesh(cylGeo, cylMatCream);
    disk3.position.y = 0.45;
    cylGroup.add(disk3);

    // Subtle edge rings for disks
    [disk1, disk2, disk3].forEach((disk) => {
      const ringEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(cylGeo),
        new THREE.LineBasicMaterial({ color: PALETTE.charcoal, transparent: true, opacity: 0.35 })
      );
      disk.add(ringEdge);
    });

    // 3. Abstract Floating Document / Data Blocks (Strictly inside enclosure)
    const slabs = [];
    const slabConfigs = [
      { size: [0.75, 0.05, 0.5], pos: [-0.65, 0.95, 0.4], rot: [0.1, 0.3, 0.05], color: PALETTE.cream },
      { size: [0.65, 0.05, 0.45], pos: [0.65, -0.9, -0.4], rot: [-0.08, -0.4, 0.1], color: PALETTE.cream },
      { size: [0.55, 0.05, 0.4], pos: [0.6, 0.85, -0.5], rot: [0.15, 0.5, -0.05], color: PALETTE.charcoalDark },
      { size: [0.5, 0.04, 0.4], pos: [-0.7, -0.85, 0.45], rot: [-0.1, -0.25, 0.08], color: PALETTE.borderDark },
    ];

    slabConfigs.forEach((cfg, idx) => {
      const sGeo = new THREE.BoxGeometry(...cfg.size);
      const sMat = new THREE.MeshStandardMaterial({
        color: cfg.color,
        roughness: 0.4,
        metalness: 0.1,
      });
      const slab = new THREE.Mesh(sGeo, sMat);
      slab.position.set(...cfg.pos);
      slab.rotation.set(...cfg.rot);

      const sEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(sGeo),
        new THREE.LineBasicMaterial({ color: PALETTE.charcoal, transparent: true, opacity: 0.4 })
      );
      slab.add(sEdges);
      vaultGroup.add(slab);

      slabs.push({ mesh: slab, basePos: new THREE.Vector3(...cfg.pos), phase: idx * 1.3 });
    });

    // Interactive mouse parallax
    let mouseX = 0, mouseY = 0, isVisible = true;
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.45;
      mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
    });

    let clock = new THREE.Clock();
    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);

      const time = clock.getElapsedTime();

      if (!REDUCED_MOTION) {
        // Slow calm rotation of entire vault
        vaultGroup.rotation.y = time * 0.08;
        cylGroup.rotation.y = -time * 0.12;

        // Subtle independent floating of internal data slabs
        slabs.forEach((s) => {
          s.mesh.position.y = s.basePos.y + Math.sin(time * 1.1 + s.phase) * 0.06;
          s.mesh.rotation.y = s.mesh.rotation.y + 0.002;
        });

        // Camera parallax lerp
        camera.position.x += (mouseX - camera.position.x) * 0.06;
        camera.position.y += (-mouseY + 0.4 - camera.position.y) * 0.06;
        camera.lookAt(0, 0.1, 0);
      }

      renderer.render(scene, camera);
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) animate();
      }, { threshold: 0.1 });
      io.observe(stage);
    }

    window.addEventListener('resize', () => {
      if (!stage.clientWidth || !stage.clientHeight) return;
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    });

    animate();
  }

  // =========================================================================
  // ARTIFACT 3: SECTION 02 - ADVERSARIAL SIGNAL FIELD
  // =========================================================================
  function initAdversarialFieldArtifact() {
    const stage = document.getElementById('stage-adversarial');
    const canvas = document.getElementById('canvas-adversarial');
    if (!stage || !canvas) return;

    const setup = createSceneSetup(canvas, stage, 32);
    if (!setup) return;
    const { renderer, scene, camera } = setup;
    camera.position.set(0, 0, 6.8);

    const fieldGroup = new THREE.Group();
    scene.add(fieldGroup);

    // 1. Boundary Datum Plane at x = 0.4 (Architectural Sentry Threshold)
    const BOUNDARY_X = 0.4;
    const planeGeo = new THREE.PlaneGeometry(0.01, 3.4);
    const planeLine = new THREE.LineSegments(
      new THREE.EdgesGeometry(planeGeo),
      new THREE.LineBasicMaterial({ color: PALETTE.charcoal, linewidth: 2 })
    );
    planeLine.position.set(BOUNDARY_X, 0, 0);
    fieldGroup.add(planeLine);

    // Datum tick lines across the boundary
    const tickGeo = new THREE.BufferGeometry();
    const tickPositions = [];
    for (let y = -1.6; y <= 1.6; y += 0.2) {
      tickPositions.push(BOUNDARY_X - 0.1, y, 0);
      tickPositions.push(BOUNDARY_X + 0.1, y, 0);
    }
    tickGeo.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
    const tickLines = new THREE.LineSegments(
      tickGeo,
      new THREE.LineBasicMaterial({ color: PALETTE.borderDark, transparent: true, opacity: 0.7 })
    );
    fieldGroup.add(tickLines);

    // 2. Adversarial Signal Vectors (Scientific kinetic simulation)
    const VECTOR_COUNT = 24;
    const vectors = [];
    const vectorGeo = new THREE.ConeGeometry(0.07, 0.32, 4);
    vectorGeo.rotateZ(-Math.PI / 2); // Point along +X axis

    for (let i = 0; i < VECTOR_COUNT; i++) {
      const vMat = new THREE.MeshBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(vectorGeo, vMat);
      fieldGroup.add(mesh);

      // Trajectory lines (subtle trail)
      const trailGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-0.35, 0, 0),
        new THREE.Vector3(0, 0, 0),
      ]);
      const trail = new THREE.Line(
        trailGeo,
        new THREE.LineBasicMaterial({ color: PALETTE.red, transparent: true, opacity: 0.35 })
      );
      mesh.add(trail);

      const startX = -3.6 + Math.random() * 3.0;
      const startY = (Math.random() - 0.5) * 2.8;
      const startZ = (Math.random() - 0.5) * 1.5;

      vectors.push({
        mesh: mesh,
        x: startX,
        y: startY,
        z: startZ,
        speed: 0.015 + Math.random() * 0.012,
        deflected: false,
        deflectAngle: (Math.random() > 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.4),
        opacity: 0.85,
      });
    }

    let mouseX = 0, mouseY = 0, isVisible = true;
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
      mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.35;
    });

    let clock = new THREE.Clock();
    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);

      if (!REDUCED_MOTION) {
        vectors.forEach((v) => {
          if (!v.deflected) {
            v.x += v.speed;
            v.mesh.position.set(v.x, v.y, v.z);
            v.mesh.rotation.z = 0;

            // Intercept at boundary line x = BOUNDARY_X
            if (v.x >= BOUNDARY_X) {
              v.deflected = true;
            }
          } else {
            // Deflected trajectory: travels backward-angled and dissolves
            v.x -= v.speed * 0.8;
            v.y += v.deflectAngle * v.speed * 1.6;
            v.mesh.position.set(v.x, v.y, v.z);
            v.mesh.rotation.z = Math.PI - v.deflectAngle;

            v.opacity -= delta * 1.6;
            v.mesh.material.opacity = Math.max(0, v.opacity);

            if (v.opacity <= 0) {
              // Reset to left ingress
              v.x = -3.8 - Math.random() * 0.8;
              v.y = (Math.random() - 0.5) * 2.8;
              v.z = (Math.random() - 0.5) * 1.5;
              v.deflected = false;
              v.opacity = 0.85;
              v.mesh.material.opacity = 0.85;
            }
          }
        });

        // Subtle scientific camera shift
        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) animate();
      }, { threshold: 0.1 });
      io.observe(stage);
    }

    window.addEventListener('resize', () => {
      if (!stage.clientWidth || !stage.clientHeight) return;
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    });

    animate();
  }

  // =========================================================================
  // ARTIFACT 4: SECTION 03 - DETERMINISTIC POLICY ENFORCEMENT GATE
  // =========================================================================
  function initPolicyGateArtifact() {
    const stage = document.getElementById('stage-policy');
    const canvas = document.getElementById('canvas-policy');
    if (!stage || !canvas) return;

    const setup = createSceneSetup(canvas, stage, 32);
    if (!setup) return;
    const { renderer, scene, camera } = setup;
    camera.position.set(0, 0, 6.8);

    const gateGroup = new THREE.Group();
    scene.add(gateGroup);

    // 1. Central Precision Caliper Monoliths (The Policy Enforcement Point)
    const caliperGeo = new THREE.BoxGeometry(0.22, 3.2, 0.45);
    const caliperMat = new THREE.MeshStandardMaterial({
      color: PALETTE.charcoal,
      roughness: 0.3,
      metalness: 0.4,
    });

    const topCaliper = new THREE.Mesh(caliperGeo, caliperMat);
    topCaliper.position.set(0, 1.45, 0);
    gateGroup.add(topCaliper);

    const bottomCaliper = new THREE.Mesh(caliperGeo, caliperMat);
    bottomCaliper.position.set(0, -1.45, 0);
    gateGroup.add(bottomCaliper);

    // Caliper edges
    [topCaliper, bottomCaliper].forEach((c) => {
      const e = new THREE.LineSegments(
        new THREE.EdgesGeometry(caliperGeo),
        new THREE.LineBasicMaterial({ color: PALETTE.borderDark, transparent: true, opacity: 0.6 })
      );
      c.add(e);
    });

    // Optical Evaluation Scanning Beam across the gap (y = -0.65 to +0.65)
    const scanGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.65, 0),
      new THREE.Vector3(0, 0.65, 0),
    ]);
    const scanMat = new THREE.LineBasicMaterial({ color: PALETTE.charcoal, linewidth: 2 });
    const scanBeam = new THREE.Line(scanGeo, scanMat);
    gateGroup.add(scanBeam);

    // Status Indicator LEDs on Calipers
    const ledGeo = new THREE.OctahedronGeometry(0.06);
    const ledMatTop = new THREE.MeshBasicMaterial({ color: PALETTE.borderDark });
    const ledTop = new THREE.Mesh(ledGeo, ledMatTop);
    ledTop.position.set(0.12, 0.45, 0);
    topCaliper.add(ledTop);

    const ledMatBottom = new THREE.MeshBasicMaterial({ color: PALETTE.borderDark });
    const ledBottom = new THREE.Mesh(ledGeo, ledMatBottom);
    ledBottom.position.set(0.12, -0.45, 0);
    bottomCaliper.add(ledBottom);

    // 2. Streaming Data Objects Cycle (INPUT -> EVAL -> OUTPUT)
    const PACKET_COUNT = 5;
    const packets = [];
    const pBoxGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);

    for (let i = 0; i < PACKET_COUNT; i++) {
      const isAdversarial = i % 2 === 1; // Alternate valid and adversarial
      const pMat = new THREE.MeshStandardMaterial({
        color: isAdversarial ? PALETTE.red : PALETTE.cream,
        roughness: 0.35,
        metalness: 0.1,
      });
      const mesh = new THREE.Mesh(pBoxGeo, pMat);
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(pBoxGeo),
        new THREE.LineBasicMaterial({ color: PALETTE.charcoal, transparent: true, opacity: 0.4 })
      );
      mesh.add(edges);
      gateGroup.add(mesh);

      packets.push({
        mesh: mesh,
        isAdversarial: isAdversarial,
        x: -3.4 - i * 1.5,
        state: 'approaching', // approaching | evaluated | passed | denied
        opacity: 1.0,
      });
    }

    let mouseX = 0, mouseY = 0, isVisible = true;
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.4;
      mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
    });

    let clock = new THREE.Clock();
    let caliperClamp = 0;

    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      if (!REDUCED_MOTION) {
        packets.forEach((p) => {
          if (p.state === 'approaching') {
            p.x += 0.022;
            p.mesh.position.set(p.x, 0, 0);
            p.mesh.rotation.y = time * 0.8;

            // Gate Boundary Evaluation at x = 0
            if (p.x >= 0) {
              if (p.isAdversarial) {
                // Denied: arrested immediately, caliper clamps slightly
                p.state = 'denied';
                caliperClamp = 1.0;
                scanMat.color.setHex(PALETTE.red);
                ledMatTop.color.setHex(PALETTE.red);
                ledMatBottom.color.setHex(PALETTE.red);
              } else {
                // Permitted: passes cleanly through to output
                p.state = 'passed';
                scanMat.color.setHex(PALETTE.sage);
                ledMatTop.color.setHex(PALETTE.sage);
                ledMatBottom.color.setHex(PALETTE.sage);
              }
            }
          } else if (p.state === 'passed') {
            p.x += 0.022;
            p.mesh.position.set(p.x, 0, 0);
            p.mesh.rotation.y = time * 0.8;

            if (p.x >= 3.6) {
              // Recycle back to input
              p.x = -3.6;
              p.state = 'approaching';
            }
          } else if (p.state === 'denied') {
            // Drops down, fragments and dissolves
            p.mesh.position.y -= delta * 0.8;
            p.opacity -= delta * 1.8;
            p.mesh.material.opacity = Math.max(0, p.opacity);

            if (p.opacity <= 0) {
              p.x = -3.6;
              p.mesh.position.set(p.x, 0, 0);
              p.opacity = 1.0;
              p.mesh.material.opacity = 1.0;
              p.state = 'approaching';
            }
          }
        });

        // Caliper clamp and relax motion
        if (caliperClamp > 0) {
          caliperClamp = Math.max(0, caliperClamp - delta * 3.5);
          topCaliper.position.y = 1.45 - caliperClamp * 0.08;
          bottomCaliper.position.y = -1.45 + caliperClamp * 0.08;

          if (caliperClamp === 0) {
            scanMat.color.setHex(PALETTE.charcoal);
            ledMatTop.color.setHex(PALETTE.borderDark);
            ledMatBottom.color.setHex(PALETTE.borderDark);
          }
        }

        // Camera parallax
        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY - camera.position.y) * 0.05;
        camera.lookAt(0, 0, 0);
      }

      renderer.render(scene, camera);
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) animate();
      }, { threshold: 0.1 });
      io.observe(stage);
    }

    window.addEventListener('resize', () => {
      if (!stage.clientWidth || !stage.clientHeight) return;
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    });

    animate();
  }

  // =========================================================================
  // ARTIFACT 5: SECTION 04 - IMMUTABLE LEDGER STRUCTURE (WORM AUDIT)
  // =========================================================================
  function initImmutableLedgerArtifact() {
    const stage = document.getElementById('stage-ledger');
    const canvas = document.getElementById('canvas-ledger');
    if (!stage || !canvas) return;

    const setup = createSceneSetup(canvas, stage, 32);
    if (!setup) return;
    const { renderer, scene, camera } = setup;
    camera.position.set(0, 0.2, 6.8);

    const ledgerGroup = new THREE.Group();
    scene.add(ledgerGroup);
    ledgerGroup.rotation.y = 0.35;
    ledgerGroup.rotation.x = 0.2;

    // A sequence of interconnected Merkle blocks along an isometric diagonal
    const BLOCK_SIZE = 0.62;
    const blockGeo = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const blockMat = new THREE.MeshStandardMaterial({
      color: PALETTE.charcoal,
      roughness: 0.3,
      metalness: 0.3,
    });
    const blockMatCream = new THREE.MeshStandardMaterial({
      color: PALETTE.cream,
      roughness: 0.35,
      metalness: 0.1,
    });

    const blocks = [];
    const chainSpacing = 1.15;
    const TOTAL_SLOTS = 5;

    for (let i = 0; i < TOTAL_SLOTS; i++) {
      const posX = (i - 2) * chainSpacing * 0.85;
      const posY = (i - 2) * chainSpacing * 0.45;
      const posZ = -(i - 2) * chainSpacing * 0.6;

      const mesh = new THREE.Mesh(blockGeo, (i % 2 === 0) ? blockMat : blockMatCream);
      mesh.position.set(posX, posY, posZ);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(blockGeo),
        new THREE.LineBasicMaterial({ color: PALETTE.borderDark, transparent: true, opacity: 0.5 })
      );
      mesh.add(edges);
      ledgerGroup.add(mesh);

      // Connecting cryptographic hash rods to previous block
      let connector = null;
      if (i > 0) {
        const prev = blocks[i - 1].mesh.position;
        const curr = mesh.position;
        const dist = prev.distanceTo(curr);

        const rodGeo = new THREE.CylinderGeometry(0.02, 0.02, dist, 16);
        rodGeo.rotateX(Math.PI / 2);
        const rodMat = new THREE.MeshBasicMaterial({ color: PALETTE.charcoal });
        connector = new THREE.Mesh(rodGeo, rodMat);
        connector.position.copy(prev).lerp(curr, 0.5);
        connector.lookAt(curr);
        ledgerGroup.add(connector);
      }

      blocks.push({
        mesh: mesh,
        connector: connector,
        basePos: new THREE.Vector3(posX, posY, posZ),
        isHead: (i === TOTAL_SLOTS - 1),
      });
    }

    // Periodic Cryptographic Block Assembly Cycle
    let lockTimer = 0;
    let lockPulse = 0;

    let mouseX = 0, mouseY = 0, isVisible = true;
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      mouseX = ((e.clientX - r.left) / r.width - 0.5) * 0.4;
      mouseY = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
    });

    let clock = new THREE.Clock();
    function animate() {
      if (!isVisible) return;
      requestAnimationFrame(animate);

      const delta = Math.min(clock.getDelta(), 0.1);
      const time = clock.getElapsedTime();

      if (!REDUCED_MOTION) {
        // Slow structural progression
        ledgerGroup.rotation.y = 0.35 + Math.sin(time * 0.4) * 0.08;
        ledgerGroup.rotation.x = 0.2 + Math.cos(time * 0.3) * 0.05;

        // Periodic new block locking cycle (~3.5 seconds)
        lockTimer += delta;
        if (lockTimer >= 3.5) {
          lockTimer = 0;
          lockPulse = 1.0;
        }

        if (lockPulse > 0) {
          lockPulse = Math.max(0, lockPulse - delta * 2.0);
          const headBlock = blocks[blocks.length - 1];
          // Emit subtle green proof flash (#1E653A) on locking
          if (lockPulse > 0.05) {
            headBlock.mesh.material.color.setHex(PALETTE.sage);
          } else {
            headBlock.mesh.material.color.setHex(PALETTE.charcoal);
          }
        }

        // Camera parallax
        camera.position.x += (mouseX - camera.position.x) * 0.05;
        camera.position.y += (-mouseY + 0.2 - camera.position.y) * 0.05;
        camera.lookAt(0, 0.1, 0);
      }

      renderer.render(scene, camera);
    }

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([entry]) => {
        isVisible = entry.isIntersecting;
        if (isVisible) animate();
      }, { threshold: 0.1 });
      io.observe(stage);
    }

    window.addEventListener('resize', () => {
      if (!stage.clientWidth || !stage.clientHeight) return;
      camera.aspect = stage.clientWidth / stage.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    });

    animate();
  }

  // =========================================================================
  // GLOBAL LIFECYCLE CONTROLLER
  // =========================================================================
  function initAllAegis3DArtifacts() {
    if (typeof THREE === 'undefined') {
      console.warn('[Aegis 3D] Three.js not loaded yet, retrying...');
      setTimeout(initAllAegis3DArtifacts, 100);
      return;
    }

    // Initialize all 5 artifacts
    initHeroPolicyBoundary();
    initAssetVaultArtifact();
    initAdversarialFieldArtifact();
    initPolicyGateArtifact();
    initImmutableLedgerArtifact();

    console.log('[Aegis 3D] All 5 interactive 3D technical artifacts successfully mounted.');
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllAegis3DArtifacts);
  } else {
    initAllAegis3DArtifacts();
  }

  // Expose globally if manual re-init needed
  window.initAllAegis3DArtifacts = initAllAegis3DArtifacts;
})();
