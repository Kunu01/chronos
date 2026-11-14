import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

const clampVal = (v, min, max) => Math.max(min, Math.min(max, v));
const smoothstep = (edge0, edge1, x) => {
  const t = clampVal((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

// Deterministic pseudo-noise helpers for realistic terrain & textures
const hash2D = (x, y) => {
  const h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return h - Math.floor(h);
};

const valueNoise2D = (x, y) => {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy);
  const b = hash2D(ix + 1, iy);
  const c = hash2D(ix, iy + 1);
  const d = hash2D(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
};

const fbm2D = (x, y, octaves = 4) => {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * valueNoise2D(x * freq, y * freq);
    freq *= 2.02;
    amp *= 0.5;
  }
  return val;
};

/**
 * Generates procedural PBR CanvasTextures & Equirectangular Reflection Map
 */
const useProceduralAssets = (isDark) => {
  return useMemo(() => {
    const makeCanvas = (w, h) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      return c;
    };

    // 1. Equirectangular Reflection Map (for train clearcoat, chrome, rails, water)
    const envCanvas = makeCanvas(512, 256);
    const envCtx = envCanvas.getContext('2d');
    const envGrad = envCtx.createLinearGradient(0, 0, 0, 256);
    if (isDark) {
      envGrad.addColorStop(0.0, '#070B19');
      envGrad.addColorStop(0.35, '#3B1640');
      envGrad.addColorStop(0.48, '#E11D48');
      envGrad.addColorStop(0.54, '#FDE047');
      envGrad.addColorStop(0.62, '#2B1829');
      envGrad.addColorStop(1.0, '#090D16');
    } else {
      envGrad.addColorStop(0.0, '#1E3A5F');
      envGrad.addColorStop(0.32, '#831843');
      envGrad.addColorStop(0.47, '#FB7185');
      envGrad.addColorStop(0.53, '#FEF08A');
      envGrad.addColorStop(0.62, '#573242');
      envGrad.addColorStop(1.0, '#14241C');
    }
    envCtx.fillStyle = envGrad;
    envCtx.fillRect(0, 0, 512, 256);

    const sunGrad = envCtx.createRadialGradient(256, 130, 4, 256, 130, 75);
    sunGrad.addColorStop(0, 'rgba(255, 252, 220, 1.0)');
    sunGrad.addColorStop(0.35, 'rgba(253, 224, 71, 0.55)');
    sunGrad.addColorStop(1, 'rgba(251, 113, 133, 0)');
    envCtx.fillStyle = sunGrad;
    envCtx.fillRect(160, 50, 192, 160);

    const envTex = new THREE.CanvasTexture(envCanvas);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    envTex.colorSpace = THREE.SRGBColorSpace;

    // 2. Crushed Granite Ballast Texture
    const gravelCanvas = makeCanvas(256, 256);
    const gCtx = gravelCanvas.getContext('2d');
    gCtx.fillStyle = '#474B52';
    gCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6500; i++) {
      const x = (hash2D(i, 1.3) * 256) | 0;
      const y = (hash2D(i, 7.9) * 256) | 0;
      const s = 1 + ((hash2D(i, 3.1) * 3) | 0);
      const shade = 48 + ((hash2D(i, 9.4) * 75) | 0);
      gCtx.fillStyle = `rgb(${shade},${shade - 2},${shade + 2})`;
      gCtx.fillRect(x, y, s, s);
    }
    const gravelTex = new THREE.CanvasTexture(gravelCanvas);
    gravelTex.wrapS = THREE.RepeatWrapping;
    gravelTex.wrapT = THREE.RepeatWrapping;
    gravelTex.repeat.set(2, 200);
    gravelTex.colorSpace = THREE.SRGBColorSpace;

    // 3. Weathered Creosote Wood Grain Texture
    const woodCanvas = makeCanvas(128, 128);
    const wCtx = woodCanvas.getContext('2d');
    wCtx.fillStyle = '#4A2C18';
    wCtx.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y++) {
      const v = 35 + ((fbm2D(y * 0.25, 4.2, 3) * 45) | 0);
      wCtx.fillStyle = `rgb(${v + 24},${v + 6},${Math.max(8, v - 8)})`;
      wCtx.fillRect(0, y, 128, 1);
    }
    const woodTex = new THREE.CanvasTexture(woodCanvas);
    woodTex.colorSpace = THREE.SRGBColorSpace;

    // 4. Organic Terrain Micro-Detail Texture
    const terrainCanvas = makeCanvas(256, 256);
    const tCtx = terrainCanvas.getContext('2d');
    tCtx.fillStyle = '#888888';
    tCtx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5500; i++) {
      const x = (hash2D(i, 2.1) * 256) | 0;
      const y = (hash2D(i, 5.7) * 256) | 0;
      const v = 105 + ((hash2D(i, 8.3) * 55) | 0);
      tCtx.fillStyle = `rgb(${v},${v},${v})`;
      tCtx.fillRect(x, y, 2, 2);
    }
    const terrainDetailTex = new THREE.CanvasTexture(terrainCanvas);
    terrainDetailTex.wrapS = THREE.RepeatWrapping;
    terrainDetailTex.wrapT = THREE.RepeatWrapping;
    terrainDetailTex.repeat.set(42, 110);

    // 5. Concrete Platform Stone Tile Texture
    const tileCanvas = makeCanvas(256, 256);
    const pCtx = tileCanvas.getContext('2d');
    pCtx.fillStyle = isDark ? '#2A2330' : '#D6CFD8';
    pCtx.fillRect(0, 0, 256, 256);
    pCtx.strokeStyle = isDark ? 'rgba(0,0,0,0.4)' : 'rgba(90,70,85,0.22)';
    pCtx.lineWidth = 2;
    for (let x = 0; x <= 256; x += 64) {
      pCtx.beginPath();
      pCtx.moveTo(x, 0);
      pCtx.lineTo(x, 256);
      pCtx.stroke();
    }
    for (let y = 0; y <= 256; y += 64) {
      pCtx.beginPath();
      pCtx.moveTo(0, y);
      pCtx.lineTo(256, y);
      pCtx.stroke();
    }
    const tileTex = new THREE.CanvasTexture(tileCanvas);
    tileTex.wrapS = THREE.RepeatWrapping;
    tileTex.wrapT = THREE.RepeatWrapping;
    tileTex.repeat.set(2, 8);
    tileTex.colorSpace = THREE.SRGBColorSpace;

    // 6. Night City Skyscraper Window Grid Texture
    const cityCanvas = makeCanvas(128, 256);
    const cCtx = cityCanvas.getContext('2d');
    cCtx.fillStyle = '#0F172A';
    cCtx.fillRect(0, 0, 128, 256);
    for (let row = 8; row < 248; row += 12) {
      for (let col = 8; col < 120; col += 14) {
        const lit = hash2D(col * 0.7, row * 1.3);
        if (lit > 0.35) {
          cCtx.fillStyle = lit > 0.82 ? '#38BDF8' : lit > 0.55 ? '#FDE68A' : '#FB923C';
          cCtx.fillRect(col, row, 8, 7);
        } else {
          cCtx.fillStyle = '#1E293B';
          cCtx.fillRect(col, row, 8, 7);
        }
      }
    }
    const cityWindowTex = new THREE.CanvasTexture(cityCanvas);
    cityWindowTex.colorSpace = THREE.SRGBColorSpace;

    return { envTex, gravelTex, woodTex, terrainDetailTex, tileTex, cityWindowTex };
  }, [isDark]);
};

/**
 * Dynamic 24-Hour Atmospheric Sky Dome (Morning -> Afternoon -> Evening Sunset -> Moonlit Night)
 * Driven smoothly by progressRef (`0.0 -> 1.0`) with zero React re-renders.
 */
const DynamicTimeSkyDome = ({ progressRef, isDark }) => {
  const matRef = useRef(null);
  const groupRef = useRef(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uDayPhase: { value: 0 },
      uDark: { value: isDark ? 1.0 : 0.0 },
    }),
    [isDark]
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      matRef.current.uniforms.uDayPhase.value = clampVal(progressRef.current, 0, 1);
    }
    if (groupRef.current) {
      // Keep sky dome centered around camera so horizon & stars never shift awkwardly
      groupRef.current.position.copy(state.camera.position);
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[560, 48, 32]} />
        <shaderMaterial
          ref={matRef}
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={`
            varying vec3 vWorldDir;
            void main() {
              vWorldDir = normalize(position);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform float uDayPhase;
            uniform float uDark;
            varying vec3 vWorldDir;

            float hash(vec2 p) {
              return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              vec2 u = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
                u.y
              );
            }
            float fbm(vec2 p) {
              float v = 0.0;
              float a = 0.5;
              for (int i = 0; i < 4; i++) {
                v += a * noise(p);
                p *= 2.03;
                a *= 0.5;
              }
              return v;
            }

            void main() {
              vec3 dir = normalize(vWorldDir);
              float h = clamp(dir.y, -0.15, 1.0);
              float p = clamp(uDayPhase, 0.0, 1.0);

              // Phase weights: Morning (0.0-0.25), Afternoon (0.25-0.50), Evening (0.50-0.75), Night (0.75-1.0)
              float wMorn  = 1.0 - smoothstep(0.16, 0.30, p);
              float wAft   = smoothstep(0.16, 0.30, p) * (1.0 - smoothstep(0.42, 0.56, p));
              float wEve   = smoothstep(0.42, 0.56, p) * (1.0 - smoothstep(0.68, 0.82, p));
              float wNight = smoothstep(0.68, 0.82, p);

              // 1. Morning Dawn Colors
              vec3 mornHor = vec3(1.0, 0.84, 0.62);
              vec3 mornMid = vec3(0.96, 0.62, 0.72);
              vec3 mornZen = vec3(0.24, 0.58, 0.86);
              vec3 skyMorn = mix(mornHor, mornMid, smoothstep(-0.02, 0.22, h));
              skyMorn = mix(skyMorn, mornZen, smoothstep(0.18, 0.72, h));

              // 2. Afternoon Crisp Sky Colors (with slight monsoon overcast around p ~ 0.36)
              float rainMood = smoothstep(0.26, 0.34, p) * (1.0 - smoothstep(0.40, 0.48, p));
              vec3 aftHor = mix(vec3(0.68, 0.88, 0.98), vec3(0.42, 0.50, 0.58), rainMood * 0.7);
              vec3 aftZen = mix(vec3(0.10, 0.46, 0.82), vec3(0.20, 0.28, 0.38), rainMood * 0.75);
              vec3 skyAft = mix(aftHor, aftZen, smoothstep(-0.02, 0.68, h));

              // 3. Evening Romantic Sunset Colors
              vec3 eveHor = vec3(1.0, 0.74, 0.36);
              vec3 eveMid = vec3(0.94, 0.36, 0.48);
              vec3 eveZen = vec3(0.18, 0.12, 0.36);
              vec3 skyEve = mix(eveHor, eveMid, smoothstep(-0.02, 0.22, h));
              skyEve = mix(skyEve, eveZen, smoothstep(0.18, 0.76, h));

              // 4. Starry Night Colors
              vec3 ngtHor = vec3(0.06, 0.10, 0.22);
              vec3 ngtZen = vec3(0.01, 0.02, 0.06);
              vec3 skyNight = mix(ngtHor, ngtZen, smoothstep(-0.02, 0.65, h));

              vec3 sky = skyMorn * wMorn + skyAft * wAft + skyEve * wEve + skyNight * wNight;

              // Dynamic Sun Direction (rises east-ahead in morning, high overhead in afternoon, sets ahead-west in evening)
              vec3 sunDir = normalize(vec3(
                mix(0.45, -0.35, p),
                sin(clamp(p / 0.78, 0.0, 1.0) * 3.14159) * 0.75 + 0.06,
                -0.85
              ));
              float sunDot = max(dot(dir, sunDir), 0.0);
              float sunVis = (1.0 - wNight) * (1.0 - rainMood * 0.65);
              sky += vec3(1.0, 0.85, 0.55) * (pow(sunDot, 9.0) * 0.45 + pow(sunDot, 64.0) * 0.5) * sunVis;
              sky = mix(sky, vec3(1.0, 0.98, 0.9), smoothstep(0.9975, 0.9992, sunDot) * sunVis);

              // Glowing Silver Full Moon at Night
              vec3 moonDir = normalize(vec3(0.28, 0.36, -0.88));
              float moonDot = max(dot(dir, moonDir), 0.0);
              sky += vec3(0.65, 0.80, 1.0) * pow(moonDot, 16.0) * 0.35 * wNight;
              sky = mix(sky, vec3(0.95, 0.97, 1.0), smoothstep(0.9980, 0.9993, moonDot) * wNight);

              // Animated FBM Clouds
              if (dir.y > 0.015) {
                vec2 cloudUV = dir.xz / (dir.y + 0.18) * 1.45 + vec2(uTime * 0.008, uTime * 0.004);
                float c1 = fbm(cloudUV);
                float c2 = fbm(cloudUV * 2.1 - vec2(uTime * 0.005, 0.0));
                float cloudMask = smoothstep(0.46 - rainMood * 0.14, 0.76, c1 * 0.7 + c2 * 0.35);
                cloudMask *= smoothstep(0.015, 0.14, dir.y) * smoothstep(0.85, 0.22, dir.y);

                vec3 dayCloud = mix(vec3(0.95, 0.97, 1.0), vec3(0.32, 0.38, 0.46), rainMood * 0.8);
                vec3 eveCloud = vec3(1.0, 0.68, 0.64);
                vec3 ngtCloud = vec3(0.10, 0.14, 0.24);
                vec3 cloudCol = dayCloud * (wMorn + wAft) + eveCloud * wEve + ngtCloud * wNight;
                sky = mix(sky, cloudCol, cloudMask * (0.68 + rainMood * 0.22));
              }

              // Twinkling Stars at Evening Dusk & Night
              float starVis = clamp(wEve * 0.45 + wNight, 0.0, 1.0);
              if (dir.y > 0.12 && starVis > 0.02) {
                vec2 starCell = floor(dir.xz / (dir.y + 0.35) * 145.0);
                float starRand = hash(starCell);
                if (starRand > 0.992) {
                  float twinkle = 0.55 + 0.45 * sin(uTime * 2.8 + starRand * 100.0);
                  float starFade = smoothstep(0.12, 0.52, dir.y);
                  sky += vec3(0.96, 0.97, 1.0) * twinkle * starFade * starVis;
                }
              }

              if (uDark > 0.5) {
                sky *= 0.84;
              }

              gl_FragColor = vec4(sky, 1.0);
            }
          `}
        />
      </mesh>
    </group>
  );
};

/**
 * Sculpted Real-World Multi-Biome 3D Terrain Mesh
 * Carves a river channel + railway corridor across Spring Meadows, Summer Mountains,
 * Autumn Valleys, Golden Desert, Winter Ice Mountains, City Coast, and Ocean Seabed.
 */
const RealisticTerrain = ({ curve, totalLength, detailTex, isDark }) => {
  const terrainGeo = useMemo(() => {
    const segX = 72;
    const segZ = 200;
    const width = 340;
    const len = totalLength + 240;

    const geo = new THREE.PlaneGeometry(width, len, segX, segZ);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);

    const samples = 240;
    const trackPts = [];
    for (let i = 0; i <= samples; i++) {
      trackPts.push(curve.getPointAt(i / samples));
    }

    const cMeadow = new THREE.Color(isDark ? '#143824' : '#2E6F40');
    const cMeadowLight = new THREE.Color(isDark ? '#1E4D2B' : '#4A8B4F');
    const cRock = new THREE.Color('#475569');
    const cRockDark = new THREE.Color('#334155');
    const cIce = new THREE.Color('#BAE6FD');
    const cSnow = new THREE.Color('#F8FAFC');
    const cAutumn = new THREE.Color('#B45309');
    const cDesert = new THREE.Color('#D97706');
    const cDesertBright = new THREE.Color('#F59E0B');
    const cCityAsphalt = new THREE.Color('#1E293B');
    const cSeabed = new THREE.Color('#0E4F61');
    const tmpCol = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vz = pos.getZ(i) - totalLength * 0.5;
      pos.setZ(i, vz);

      const u = clampVal(-vz / totalLength, 0, 1);
      const sIdx = Math.min(samples, Math.max(0, Math.round(u * samples)));
      const tp = trackPts[sIdx];
      const latDist = Math.abs(vx - tp.x);

      const n1 = fbm2D(vx * 0.025 + 10.5, vz * 0.025 + 4.2, 4);
      const n2 = fbm2D(vx * 0.08 + 2.1, vz * 0.08 + 9.8, 3);
      let h = -0.75 + (n1 - 0.45) * 4.5;

      if (u < 0.20) {
        // Spring Green Meadow & River Valley
        h += Math.sin(vx * 0.04) * 1.4 + n1 * 3.0;
        tmpCol.lerpColors(cMeadow, cMeadowLight, clampVal(n1 * 1.3, 0, 1));
      } else if (u < 0.42) {
        // Summer Mountains, Temples & Monsoon Canyon
        const canyonWall = smoothstep(8.0, 42.0, latDist) * (14.5 + n1 * 18.0);
        const crag = (n2 - 0.3) * 6.5;
        h += canyonWall + crag * smoothstep(6.0, 20.0, latDist);
        tmpCol.lerpColors(cRockDark, cRock, clampVal(n2 * 1.4, 0, 1));
        if (h < 3.5) tmpCol.lerp(cMeadow, 0.55);
      } else if (u < 0.56) {
        // Autumn Maple Hills
        h += smoothstep(9.0, 38.0, latDist) * (6.0 + n1 * 6.5);
        tmpCol.lerpColors(cMeadow, cAutumn, clampVal(0.5 + n1 * 0.5, 0, 1));
      } else if (u < 0.68) {
        // Golden Desert Sand Dunes
        const dune = Math.abs(Math.sin(vx * 0.09 + vz * 0.04 + n1 * 2.5)) * 5.6;
        h += smoothstep(6.5, 28.0, latDist) * dune;
        tmpCol.lerpColors(cDesert, cDesertBright, clampVal(dune / 5.6, 0, 1));
      } else if (u < 0.82) {
        // Winter Ice & Snow Mountains
        const peak = smoothstep(7.5, 40.0, latDist) * (19.0 + n1 * 23.0);
        h += peak + (n2 - 0.35) * 7.5;
        const snowBlend = smoothstep(3.5, 9.5, h);
        tmpCol.lerpColors(cRockDark, cIce, clampVal(n2 * 1.1, 0, 1));
        tmpCol.lerp(cSnow, snowBlend);
      } else if (u < 0.90) {
        // Night City Plain
        h = -0.7;
        tmpCol.copy(cCityAsphalt);
      } else {
        // Coastal Seabed (Under-the-Sea / Marine Drive)
        h = -2.1 + (n2 - 0.5) * 1.1;
        tmpCol.copy(cSeabed);
      }

      // Carve clean railway corridor
      const corridorMask = smoothstep(3.8, 12.5, latDist);
      const trackFloor = Math.min(tp.y - 0.85, -0.75);
      h = THREE.MathUtils.lerp(trackFloor, h, corridorMask);

      if (latDist < 6.5 && u < 0.82) {
        tmpCol.lerp(cRockDark, (1 - smoothstep(2.5, 6.5, latDist)) * 0.5);
      }

      pos.setY(i, h);
      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [curve, totalLength, isDark]);

  return (
    <mesh geometry={terrainGeo} receiveShadow>
      <meshStandardMaterial vertexColors map={detailTex} roughness={0.92} metalness={0.04} />
    </mesh>
  );
};

/**
 * Animated GLSL Ocean & Flowing Spring River Water
 */
const RealisticOceanSurface = ({ center, isDark }) => {
  const matRef = useRef(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.0, 0.22, -1.0).normalize() },
      uDark: { value: isDark ? 1.0 : 0.0 },
    }),
    [isDark]
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[center.x, 7.6, center.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[180, 125, 48, 48]} />
      <shaderMaterial
        ref={matRef}
        transparent
        side={THREE.DoubleSide}
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          varying vec3 vWorldPos;
          void main() {
            vec3 p = position;
            p.z += sin(p.x * 0.25 + uTime * 1.4) * 0.14 + cos(p.y * 0.32 - uTime * 1.1) * 0.12;
            vec4 wp = modelMatrix * vec4(p, 1.0);
            vWorldPos = wp.xyz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `}
        fragmentShader={`
          uniform float uTime;
          uniform vec3 uSunDir;
          uniform float uDark;
          varying vec3 vWorldPos;

          void main() {
            float wx = sin(vWorldPos.x * 0.7 + uTime * 1.8) * 0.08 + cos(vWorldPos.z * 1.1 - uTime * 1.3) * 0.05;
            float wz = cos(vWorldPos.z * 0.8 + uTime * 1.5) * 0.08 + sin(vWorldPos.x * 1.2 + uTime * 1.2) * 0.05;
            vec3 N = normalize(vec3(wx, 1.0, wz));
            vec3 V = normalize(cameraPosition - vWorldPos);
            float fresnel = pow(1.0 - max(dot(N, V), 0.0), 3.2);

            vec3 deepWater = vec3(0.02, 0.18, 0.30);
            vec3 moonRefl = vec3(0.45, 0.65, 0.92);
            vec3 waterCol = mix(deepWater, moonRefl, fresnel * 0.72);

            vec3 H = normalize(normalize(uSunDir) + V);
            float spec = pow(max(dot(N, H), 0.0), 96.0);
            waterCol += vec3(0.85, 0.92, 1.0) * spec * 1.1;

            gl_FragColor = vec4(waterCol, 0.56);
          }
        `}
      />
    </mesh>
  );
};

/**
 * Animated GLSL Cascading Waterfall Sheet with Aerated Foam & Mist
 */
const RealisticWaterfall = ({ position }) => {
  const matRef = useRef(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 7.0, 0]} castShadow receiveShadow>
        <dodecahedronGeometry args={[6.8, 1]} />
        <meshStandardMaterial color="#334155" roughness={0.94} />
      </mesh>
      <mesh position={[-1.5, 11.2, 1.2]} castShadow>
        <dodecahedronGeometry args={[4.8, 1]} />
        <meshStandardMaterial color="#475569" roughness={0.92} />
      </mesh>
      <mesh position={[0.4, 13.6, 0]}>
        <cylinderGeometry args={[4.4, 5.2, 1.4, 12]} />
        <meshStandardMaterial color="#1E5631" roughness={0.9} />
      </mesh>

      <mesh position={[4.1, 7.0, 0]} rotation={[0, Math.PI / 2, 0.12]}>
        <planeGeometry args={[4.8, 14.2, 12, 24]} />
        <shaderMaterial
          ref={matRef}
          transparent
          side={THREE.DoubleSide}
          depthWrite={false}
          uniforms={uniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p); vec2 f = fract(p);
              vec2 u = f*f*(3.0-2.0*f);
              return mix(mix(hash(i), hash(i+vec2(1.,0.)), u.x), mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), u.x), u.y);
            }
            void main() {
              vec2 flowUv = vec2(vUv.x * 6.0, vUv.y * 4.5 + uTime * 2.4);
              float n1 = noise(flowUv);
              float n2 = noise(flowUv * 2.2 + vec2(0.0, uTime * 1.4));
              float foam = smoothstep(0.42, 0.85, n1 * 0.65 + n2 * 0.45);
              foam = max(foam, smoothstep(0.18, 0.0, vUv.y) * 0.85);
              foam = max(foam, smoothstep(0.88, 1.0, vUv.y) * 0.75);
              float edgeFade = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);

              vec3 waterBase = vec3(0.22, 0.68, 0.84);
              vec3 foamCol = vec3(0.92, 0.97, 1.0);
              vec3 col = mix(waterBase, foamCol, foam);
              gl_FragColor = vec4(col, (0.62 + foam * 0.32) * edgeFade);
            }
          `}
        />
      </mesh>

      <mesh position={[6.8, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[7.2, 28]} />
        <meshStandardMaterial
          color="#0E7490"
          roughness={0.12}
          metalness={0.25}
          transparent
          opacity={0.88}
        />
      </mesh>
      <mesh position={[5.6, 0.9, 0]}>
        <sphereGeometry args={[3.4, 14, 14]} />
        <meshBasicMaterial color="#F1F5F9" transparent opacity={0.22} depthWrite={false} />
      </mesh>
    </group>
  );
};

/**
 * Photorealistic 3D Luxury Streamliner ("Chronos Grand Love Express")
 */
const ExpressTrainModel = ({ isDark, wheelsRef, envTex }) => {
  const leadWheelOffsetsZ = [-2.05, -1.35, 1.05, 1.75];
  const rearWheelOffsetsZ = [3.55, 4.25, 5.95, 6.65];
  const bogieCentersZ = [-1.7, 1.4, 3.9, 6.3];
  const car1WindowZ = [-1.45, -0.45, 0.55, 1.55];
  const car2WindowZ = [-1.4, -0.45, 0.5, 1.45];

  const bodyColor = isDark ? '#F5ECEF' : '#FAF5F0';
  const lowerSkirtColor = '#4A081C';
  const trimColor = '#9F1239';
  const goldAccent = '#EAB308';
  const roofColor = '#5E0B24';

  // Sculpted aerodynamic streamliner nose shell (extruded 2D side silhouette with smooth bevels)
  const noseGeo = useMemo(() => {
    const shape = new THREE.Shape();
    // Side profile in (z, y) coordinates; rotated later so +x_shape maps to -z (forward)
    shape.moveTo(0, 0.20);
    shape.lineTo(0.85, 0.20);
    shape.quadraticCurveTo(1.22, 0.22, 1.24, 0.40);
    shape.quadraticCurveTo(1.18, 0.66, 0.72, 0.88);
    shape.quadraticCurveTo(0.32, 1.15, 0.0, 1.22);
    shape.lineTo(0, 0.20);

    const extrude = new THREE.ExtrudeGeometry(shape, {
      depth: 1.12,
      bevelEnabled: true,
      bevelSegments: 6,
      steps: 1,
      bevelSize: 0.09,
      bevelThickness: 0.09,
      curveSegments: 16,
    });
    // Center along X (extrude depth) and orient +X_shape -> -Z (forward)
    extrude.translate(0, 0, -0.56);
    extrude.rotateY(Math.PI / 2);
    extrude.computeVertexNormals();
    return extrude;
  }, []);

  return (
    <group>
      {/* Warm interior cabin & exterior accents */}
      <pointLight position={[0, 0.98, 0.1]} color="#FFD89B" intensity={2.1} distance={6.5} decay={2} />
      <pointLight position={[0, 0.98, 5.0]} color="#FFE4A8" intensity={1.8} distance={6.0} decay={2} />

      {/* ===================================================================== */}
      {/* CAR 1: SCULPTED AERODYNAMIC LEAD OBSERVATION LOCOMOTIVE               */}
      {/* ===================================================================== */}

      {/* Lower aerodynamic chassis & underframe skirt */}
      <mesh position={[0, 0.23, 0.0]} castShadow receiveShadow>
        <boxGeometry args={[1.34, 0.22, 4.75]} />
        <meshPhysicalMaterial
          color={lowerSkirtColor}
          metalness={0.58}
          roughness={0.26}
          clearcoat={0.75}
          clearcoatRoughness={0.18}
          envMap={envTex}
          envMapIntensity={1.25}
        />
      </mesh>

      {/* Underbody equipment: air reservoirs & traction inverter box */}
      <group position={[0, 0.13, -0.15]}>
        {[-0.36, 0.36].map((xTank) => (
          <mesh key={`tank-${xTank}`} position={[xTank, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.105, 0.105, 1.5, 14]} />
            <meshStandardMaterial color="#1E293B" metalness={0.85} roughness={0.34} envMap={envTex} />
          </mesh>
        ))}
        <mesh>
          <boxGeometry args={[0.56, 0.15, 1.65]} />
          <meshStandardMaterial color="#0F172A" metalness={0.88} roughness={0.32} />
        </mesh>
      </group>

      {/* Main pearl-ivory fuselage lower waist */}
      <mesh position={[0, 0.45, 0.02]} castShadow receiveShadow>
        <boxGeometry args={[1.32, 0.24, 4.66]} />
        <meshPhysicalMaterial
          color={bodyColor}
          metalness={0.22}
          roughness={0.18}
          clearcoat={0.95}
          clearcoatRoughness={0.1}
          envMap={envTex}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Royal burgundy livery belt & champagne-gold double pinstripes */}
      {[-0.668, 0.668].map((xSide) => (
        <React.Fragment key={`car1-livery-${xSide}`}>
          <mesh position={[xSide, 0.44, 0.02]}>
            <boxGeometry args={[0.016, 0.11, 4.68]} />
            <meshPhysicalMaterial color={trimColor} metalness={0.42} roughness={0.18} clearcoat={0.9} envMap={envTex} />
          </mesh>
          <mesh position={[xSide, 0.51, 0.02]}>
            <boxGeometry args={[0.018, 0.022, 4.68]} />
            <meshStandardMaterial color={goldAccent} metalness={0.95} roughness={0.14} envMap={envTex} envMapIntensity={1.5} />
          </mesh>
          <mesh position={[xSide, 0.37, 0.02]}>
            <boxGeometry args={[0.018, 0.016, 4.68]} />
            <meshStandardMaterial color="#FDE047" metalness={0.92} roughness={0.16} envMap={envTex} />
          </mesh>
          {/* Boarding doors at rear of Car 1 */}
          <mesh position={[xSide, 0.78, 2.04]}>
            <boxGeometry args={[0.018, 0.86, 0.46]} />
            <meshPhysicalMaterial color={trimColor} metalness={0.4} roughness={0.22} clearcoat={0.85} envMap={envTex} />
          </mesh>
          <mesh position={[xSide + Math.sign(xSide) * 0.014, 0.86, 2.04]}>
            <boxGeometry args={[0.012, 0.34, 0.22]} />
            <meshStandardMaterial color="#0F172A" roughness={0.12} metalness={0.9} envMap={envTex} />
          </mesh>
          <mesh position={[xSide + Math.sign(xSide) * 0.02, 0.74, 1.84]}>
            <cylinderGeometry args={[0.01, 0.01, 0.48, 8]} />
            <meshStandardMaterial color="#F8FAFC" metalness={0.98} roughness={0.08} envMap={envTex} />
          </mesh>
        </React.Fragment>
      ))}

      {/* Interior plush carpet & walnut floor */}
      <mesh position={[0, 0.35, 0.0]}>
        <boxGeometry args={[1.24, 0.03, 4.5]} />
        <meshStandardMaterial color="#2A121C" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.37, 0.0]}>
        <boxGeometry args={[0.42, 0.012, 4.3]} />
        <meshStandardMaterial color="#9F1239" roughness={0.9} />
      </mesh>

      {/* Panoramic Window Bays & Warm Interior Lounge (Car 1) */}
      {car1WindowZ.map((zWin, idx) => (
        <group key={`c1-win-${idx}`} position={[0, 0.86, zWin]}>
          {/* Dark anodized window frame */}
          <mesh>
            <boxGeometry args={[1.30, 0.56, 0.86]} />
            <meshStandardMaterial color="#0F172A" roughness={0.35} metalness={0.7} />
          </mesh>
          {/* Warm glowing interior cabin backdrop */}
          <mesh>
            <boxGeometry args={[1.22, 0.48, 0.78]} />
            <meshStandardMaterial
              color="#FEF3C7"
              emissive="#F59E0B"
              emissiveIntensity={0.42}
              roughness={0.4}
            />
          </mesh>
          {/* Side flush tinted clearcoat glass */}
          {[-0.654, 0.654].map((xG) => (
            <mesh key={`g-${xG}`} position={[xG, 0, 0]}>
              <boxGeometry args={[0.012, 0.50, 0.80]} />
              <meshPhysicalMaterial
                color="#1E293B"
                transparent
                opacity={0.34}
                roughness={0.04}
                metalness={0.2}
                clearcoat={1.0}
                reflectivity={0.95}
                envMap={envTex}
                envMapIntensity={1.8}
              />
            </mesh>
          ))}
        </group>
      ))}

      {/* Body structural pillars & upper header band (Car 1) */}
      {[-2.22, -0.95, 0.05, 1.05, 2.24].map((zP, idx) => (
        <mesh key={`c1-pil-${idx}`} position={[0, 0.86, zP]}>
          <boxGeometry args={[1.32, 0.58, 0.14]} />
          <meshPhysicalMaterial color={bodyColor} metalness={0.2} roughness={0.2} clearcoat={0.9} envMap={envTex} />
        </mesh>
      ))}
      <mesh position={[0, 1.19, 0.02]}>
        <boxGeometry args={[1.32, 0.10, 4.66]} />
        <meshPhysicalMaterial color={bodyColor} metalness={0.2} roughness={0.2} clearcoat={0.9} envMap={envTex} />
      </mesh>
      {[-0.665, 0.665].map((xEave) => (
        <mesh key={`eave-${xEave}`} position={[xEave, 1.15, 0.02]}>
          <boxGeometry args={[0.018, 0.024, 4.68]} />
          <meshStandardMaterial color={goldAccent} metalness={0.95} roughness={0.14} envMap={envTex} />
        </mesh>
      ))}

      {/* Arched contoured roof (Car 1) */}
      <mesh position={[0, 1.23, 0.02]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.66, 0.66, 4.66, 28, 1, false, Math.PI / 2, Math.PI]} />
        <meshPhysicalMaterial
          color={roofColor}
          metalness={0.45}
          roughness={0.2}
          clearcoat={0.9}
          clearcoatRoughness={0.14}
          envMap={envTex}
          envMapIntensity={1.45}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Aerodynamic Sculpted Nose Cone Assembly (front at z = -2.30 -> -3.55) */}
      <group position={[0, 0.0, -2.31]}>
        {/* Sculpted smooth extruded nose shell */}
        <mesh geometry={noseGeo} castShadow receiveShadow>
          <meshPhysicalMaterial
            color={bodyColor}
            metalness={0.24}
            roughness={0.16}
            clearcoat={0.95}
            clearcoatRoughness={0.08}
            envMap={envTex}
            envMapIntensity={1.55}
          />
        </mesh>

        {/* Burgundy nose speed-stripe */}
        <mesh position={[0, 0.34, -0.62]} rotation={[0.42, 0, 0]}>
          <boxGeometry args={[0.52, 0.16, 1.15]} />
          <meshPhysicalMaterial color={trimColor} metalness={0.45} roughness={0.18} clearcoat={0.95} envMap={envTex} />
        </mesh>

        {/* Swept smoked-glass cab windshield */}
        <mesh position={[0, 0.90, -0.34]} rotation={[-0.78, 0, 0]}>
          <boxGeometry args={[1.06, 0.46, 0.04]} />
          <meshPhysicalMaterial
            color="#0F172A"
            roughness={0.05}
            metalness={0.35}
            clearcoat={1.0}
            reflectivity={0.95}
            envMap={envTex}
            envMapIntensity={1.9}
          />
        </mesh>
        {/* Gold windshield brow trim */}
        <mesh position={[0, 1.09, -0.14]} rotation={[-0.78, 0, 0]}>
          <boxGeometry args={[1.10, 0.03, 0.05]} />
          <meshStandardMaterial color={goldAccent} metalness={0.95} roughness={0.14} envMap={envTex} />
        </mesh>

        {/* Upper cab destination marker light */}
        <mesh position={[0, 1.15, -0.06]}>
          <boxGeometry args={[0.32, 0.05, 0.06]} />
          <meshBasicMaterial color="#FEF08A" />
        </mesh>

        {/* Lower aerodynamic snowplow / cowcatcher skirt */}
        <mesh position={[0, 0.16, -0.92]} rotation={[0.38, 0, 0]} castShadow>
          <boxGeometry args={[1.22, 0.18, 0.62]} />
          <meshPhysicalMaterial color={lowerSkirtColor} metalness={0.55} roughness={0.25} clearcoat={0.75} envMap={envTex} />
        </mesh>
        {/* Front coupler */}
        <mesh position={[0, 0.14, -1.24]}>
          <boxGeometry args={[0.18, 0.12, 0.22]} />
          <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.35} />
        </mesh>

        {/* Front Gold Winged Crest Emblem */}
        <group position={[0, 0.48, -1.22]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.11, 0.11, 0.03, 20]} />
            <meshStandardMaterial color={goldAccent} metalness={0.96} roughness={0.14} envMap={envTex} />
          </mesh>
          <mesh position={[0, 0, -0.018]}>
            <circleGeometry args={[0.075, 16]} />
            <meshBasicMaterial color="#E11D48" />
          </mesh>
        </group>

        {/* Dual Recessed Projector Headlights + Volumetric Cones */}
        {[-0.42, 0.42].map((x) => (
          <group key={`headlight-${x}`} position={[x, 0.42, -1.06]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.105, 0.105, 0.09, 18]} />
              <meshStandardMaterial color="#F8FAFC" metalness={0.98} roughness={0.08} envMap={envTex} />
            </mesh>
            <mesh position={[0, 0, -0.042]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.08, 0.08, 0.03, 16]} />
              <meshBasicMaterial color="#FFFBEB" />
            </mesh>
            <mesh position={[0, -0.15, -2.85]} rotation={[Math.PI / 2 + 0.06, 0, 0]}>
              <coneGeometry args={[0.88, 5.5, 16, 1, true]} />
              <meshBasicMaterial
                color="#FEF3C7"
                transparent
                opacity={0.14}
                depthWrite={false}
                side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* Roof HVAC Pods */}
      {[-0.95, 1.15].map((zPos, i) => (
        <group key={`hvac-${i}`} position={[0, 1.36, zPos]}>
          <mesh>
            <boxGeometry args={[0.74, 0.11, 0.84]} />
            <meshPhysicalMaterial color={lowerSkirtColor} metalness={0.5} roughness={0.26} clearcoat={0.7} envMap={envTex} />
          </mesh>
          {[-0.22, 0, 0.22].map((zVent) => (
            <mesh key={`vent-${zVent}`} position={[0, 0.06, zVent]}>
              <boxGeometry args={[0.56, 0.015, 0.08]} />
              <meshStandardMaterial color="#0F172A" metalness={0.9} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Articulated Diamond Pantograph */}
      <group position={[0, 1.42, 0.15]}>
        {[-0.28, 0.28].map((xIns) =>
          [-0.18, 0.18].map((zIns) => (
            <mesh key={`ins-${xIns}-${zIns}`} position={[xIns, 0.04, zIns]}>
              <cylinderGeometry args={[0.032, 0.042, 0.08, 10]} />
              <meshStandardMaterial color="#94A3B8" metalness={0.75} roughness={0.28} />
            </mesh>
          ))
        )}
        <mesh position={[0, 0.18, -0.14]} rotation={[0.58, 0, 0]}>
          <boxGeometry args={[0.04, 0.44, 0.04]} />
          <meshStandardMaterial color={goldAccent} metalness={0.94} roughness={0.16} envMap={envTex} />
        </mesh>
        <mesh position={[0, 0.18, 0.14]} rotation={[-0.58, 0, 0]}>
          <boxGeometry args={[0.04, 0.44, 0.04]} />
          <meshStandardMaterial color={goldAccent} metalness={0.94} roughness={0.16} envMap={envTex} />
        </mesh>
        <mesh position={[0, 0.36, 0]}>
          <boxGeometry args={[0.92, 0.04, 0.1]} />
          <meshStandardMaterial color="#FEF08A" metalness={0.95} roughness={0.14} envMap={envTex} />
        </mesh>
        {[-0.46, 0.46].map((xTip) => (
          <mesh key={`tip-${xTip}`} position={[xTip, 0.34, 0]} rotation={[0, 0, Math.sign(xTip) * 0.4]}>
            <boxGeometry args={[0.08, 0.03, 0.08]} />
            <meshStandardMaterial color={goldAccent} metalness={0.92} envMap={envTex} />
          </mesh>
        ))}
      </group>

      {/* ===================================================================== */}
      {/* ARTICULATED INTER-COACH ACCORDION GANGWAY                           */}
      {/* ===================================================================== */}
      <group position={[0, 0.74, 2.58]}>
        {[-0.18, -0.06, 0.06, 0.18].map((zPleat, pIdx) => (
          <mesh key={`pleat-${pIdx}`} position={[0, 0, zPleat]}>
            <boxGeometry args={[1.06 + (pIdx % 2) * 0.06, 0.96 + (pIdx % 2) * 0.06, 0.075]} />
            <meshStandardMaterial color="#111827" roughness={0.86} metalness={0.18} />
          </mesh>
        ))}
        <mesh position={[0, -0.5, 0]}>
          <boxGeometry args={[0.38, 0.12, 0.68]} />
          <meshStandardMaterial color="#1E293B" metalness={0.9} roughness={0.3} />
        </mesh>
      </group>

      {/* ===================================================================== */}
      {/* CAR 2: PANORAMIC VISTA-DOME & BOAT-TAIL LOUNGE                        */}
      {/* ===================================================================== */}
      <group position={[0, 0, 5.05]}>
        <mesh position={[0, 0.23, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.34, 0.22, 4.45]} />
          <meshPhysicalMaterial color={lowerSkirtColor} metalness={0.58} roughness={0.26} clearcoat={0.75} envMap={envTex} envMapIntensity={1.25} />
        </mesh>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[1.32, 0.24, 4.42]} />
          <meshPhysicalMaterial color={bodyColor} metalness={0.22} roughness={0.18} clearcoat={0.95} envMap={envTex} envMapIntensity={1.4} />
        </mesh>

        {[-0.668, 0.668].map((xS) => (
          <React.Fragment key={`c2-livery-${xS}`}>
            <mesh position={[xS, 0.44, 0]}>
              <boxGeometry args={[0.016, 0.11, 4.44]} />
              <meshPhysicalMaterial color={trimColor} metalness={0.42} roughness={0.18} clearcoat={0.9} envMap={envTex} />
            </mesh>
            <mesh position={[xS, 0.51, 0]}>
              <boxGeometry args={[0.018, 0.022, 4.44]} />
              <meshStandardMaterial color={goldAccent} metalness={0.95} roughness={0.14} envMap={envTex} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Car 2 Panoramic Window Bays */}
        {car2WindowZ.map((zWin, idx) => (
          <group key={`c2-win-${idx}`} position={[0, 0.86, zWin]}>
            <mesh>
              <boxGeometry args={[1.30, 0.56, 0.82]} />
              <meshStandardMaterial color="#0F172A" roughness={0.35} metalness={0.7} />
            </mesh>
            <mesh>
              <boxGeometry args={[1.22, 0.48, 0.74]} />
              <meshStandardMaterial
                color="#FEF3C7"
                emissive="#F59E0B"
                emissiveIntensity={0.42}
                roughness={0.4}
              />
            </mesh>
            {[-0.654, 0.654].map((xG) => (
              <mesh key={`c2-g-${xG}`} position={[xG, 0, 0]}>
                <boxGeometry args={[0.012, 0.50, 0.76]} />
                <meshPhysicalMaterial
                  color="#1E293B"
                  transparent
                  opacity={0.34}
                  roughness={0.04}
                  clearcoat={1.0}
                  reflectivity={0.95}
                  envMap={envTex}
                  envMapIntensity={1.8}
                />
              </mesh>
            ))}
          </group>
        ))}

        {[-1.95, -0.92, 0.02, 0.98, 1.98].map((zP, idx) => (
          <mesh key={`c2-pil-${idx}`} position={[0, 0.86, zP]}>
            <boxGeometry args={[1.32, 0.58, 0.14]} />
            <meshPhysicalMaterial color={bodyColor} metalness={0.2} roughness={0.2} clearcoat={0.9} envMap={envTex} />
          </mesh>
        ))}
        <mesh position={[0, 1.19, 0]}>
          <boxGeometry args={[1.32, 0.10, 4.42]} />
          <meshPhysicalMaterial color={bodyColor} metalness={0.2} roughness={0.2} clearcoat={0.9} envMap={envTex} />
        </mesh>

        {/* Contoured Arched Roof + Vista-Dome Skylights */}
        <mesh position={[0, 1.23, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.66, 0.66, 4.42, 24, 1, false, Math.PI / 2, Math.PI]} />
          <meshPhysicalMaterial color={roofColor} metalness={0.45} roughness={0.2} clearcoat={0.9} envMap={envTex} envMapIntensity={1.45} side={THREE.DoubleSide} />
        </mesh>
        {[-0.95, 0.05, 1.05].map((zSky, idx) => (
          <mesh key={`skylight-${idx}`} position={[0, 1.26, zSky]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.67, 0.67, 0.56, 16, 1, false, Math.PI * 0.68, Math.PI * 0.64]} />
            <meshBasicMaterial color="#FEF3C7" side={THREE.DoubleSide} />
          </mesh>
        ))}

        {/* Rear Boat-Tail Observation Deck */}
        <group position={[0, 0, 2.2]}>
          <mesh position={[0, 0.68, 0]}>
            <cylinderGeometry args={[0.65, 0.65, 0.98, 22, 1, false, 0, Math.PI]} />
            <meshPhysicalMaterial color={bodyColor} metalness={0.2} roughness={0.2} clearcoat={0.9} envMap={envTex} />
          </mesh>
          <mesh position={[0, 0.68, 0.02]}>
            <cylinderGeometry args={[0.66, 0.66, 0.18, 22, 1, false, 0, Math.PI]} />
            <meshPhysicalMaterial color={trimColor} metalness={0.42} roughness={0.18} clearcoat={0.9} envMap={envTex} />
          </mesh>
          <mesh position={[0, 0.62, 0.42]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.02, 0.02, 1.06, 12]} />
            <meshStandardMaterial color={goldAccent} metalness={0.96} roughness={0.12} envMap={envTex} />
          </mesh>
          {[-0.45, -0.22, 0, 0.22, 0.45].map((xStanchion) => (
            <mesh key={`stanchion-${xStanchion}`} position={[xStanchion, 0.44, 0.42]}>
              <cylinderGeometry args={[0.015, 0.015, 0.36, 8]} />
              <meshStandardMaterial color={goldAccent} metalness={0.96} roughness={0.12} envMap={envTex} />
            </mesh>
          ))}

          {/* Illuminated Tail-Drum Crest */}
          <group position={[0, 0.52, 0.46]}>
            <mesh>
              <cylinderGeometry args={[0.18, 0.18, 0.04, 22]} />
              <meshStandardMaterial color="#1E1B24" metalness={0.85} />
            </mesh>
            <mesh position={[0, 0, 0.022]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.17, 0.018, 10, 24]} />
              <meshBasicMaterial color="#E11D48" />
            </mesh>
            <mesh position={[0, 0, 0.022]}>
              <circleGeometry args={[0.15, 22]} />
              <meshBasicMaterial color="#FFF1F2" />
            </mesh>
            <mesh position={[0, 0, 0.028]}>
              <circleGeometry args={[0.11, 20]} />
              <meshBasicMaterial color="#F59E0B" />
            </mesh>
          </group>

          {[-0.48, 0.48].map((x) => (
            <group key={`tail-lamp-${x}`} position={[x, 0.54, 0.28]}>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.065, 0.065, 0.05, 12]} />
                <meshStandardMaterial color="#1E293B" metalness={0.9} />
              </mesh>
              <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.02, 12]} />
                <meshBasicMaterial color="#FF1E42" />
              </mesh>
            </group>
          ))}
        </group>
      </group>

      {/* ===================================================================== */}
      {/* STATIC BOGIE TRUCKS & SUSPENSION SPRINGS (DO NOT ROTATE WITH AXLES)   */}
      {/* ===================================================================== */}
      {bogieCentersZ.map((zBogie, bIdx) => (
        <group key={`bogie-${bIdx}`} position={[0, 0.16, zBogie]}>
          {/* Central bolster beam */}
          <mesh>
            <boxGeometry args={[1.30, 0.09, 0.26]} />
            <meshStandardMaterial color="#1E293B" metalness={0.88} roughness={0.3} />
          </mesh>
          {[-0.68, 0.68].map((xSide) => (
            <group key={`bframe-${xSide}`} position={[xSide, 0.02, 0]}>
              <mesh>
                <boxGeometry args={[0.07, 0.11, 1.02]} />
                <meshStandardMaterial color="#1E293B" metalness={0.86} roughness={0.32} envMap={envTex} />
              </mesh>
              {[-0.22, 0.22].map((zSpring) => (
                <mesh key={`spr-${zSpring}`} position={[0, 0.06, zSpring]}>
                  <cylinderGeometry args={[0.038, 0.038, 0.09, 10]} />
                  <meshStandardMaterial color={goldAccent} metalness={0.94} roughness={0.18} envMap={envTex} />
                </mesh>
              ))}
            </group>
          ))}
        </group>
      ))}

      {/* ===================================================================== */}
      {/* SPINNING STEEL WHEELSETS & AXLES                                      */}
      {/* ===================================================================== */}
      <group ref={wheelsRef}>
        {[...leadWheelOffsetsZ, ...rearWheelOffsetsZ].map((zPos, idx) => (
          <group key={`axle-${idx}`} position={[0, 0.14, zPos]}>
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.048, 0.048, 1.24, 12]} />
              <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.25} envMap={envTex} />
            </mesh>
            {[-0.58, 0.58].map((xWheel) => (
              <group key={`w-${xWheel}`} position={[xWheel, 0, 0]}>
                <mesh position={[Math.sign(xWheel) * 0.05, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.22, 0.22, 0.03, 20]} />
                  <meshStandardMaterial color="#475569" metalness={0.94} roughness={0.18} envMap={envTex} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.19, 0.19, 0.11, 20]} />
                  <meshStandardMaterial color="#94A3B8" metalness={0.96} roughness={0.14} envMap={envTex} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.14, 0.14, 0.12, 16]} />
                  <meshStandardMaterial color="#CBD5E1" metalness={0.92} roughness={0.22} envMap={envTex} />
                </mesh>
                <mesh rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.07, 0.07, 0.135, 14]} />
                  <meshStandardMaterial color={goldAccent} metalness={0.94} roughness={0.16} envMap={envTex} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
      </group>
    </group>
  );
};

/**
 * 3D Station Platform & Elevated Memory Signboard
 */
const StationPlatform3D = ({
  station,
  index,
  position,
  rotY,
  sideSign,
  onSelect,
  tileTex,
  envTex,
}) => {
  const platformXOffset = sideSign * 3.2;
  const boardXOffset = sideSign * 3.4;
  const boardZOffset = -3.8;
  const boardY = 1.7;
  const boardRotY = Math.atan2(-sideSign * 1.4, -3.4);

  const formattedDate = station?.milestoneDate
    ? new Date(station.milestoneDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : station?.date || '';
  const stationTitle = station?.stationTitle || station?.stationName || `Milestone ${index + 1}`;
  const captionSnippet = station?.assets?.[0]?.caption || station?.caption || '';

  return (
    <group position={[position.x, position.y, position.z]} rotation={[0, rotY, 0]}>
      <mesh position={[platformXOffset, 0.14, 0]} receiveShadow>
        <boxGeometry args={[3.4, 0.28, 16.0]} />
        <meshStandardMaterial map={tileTex} roughness={0.75} metalness={0.08} />
      </mesh>
      <mesh position={[platformXOffset, -3.2, 0]}>
        <boxGeometry args={[3.0, 6.4, 15.5]} />
        <meshStandardMaterial color="#271D26" roughness={0.92} />
      </mesh>

      <mesh position={[sideSign * 1.45, 0.29, 0]}>
        <boxGeometry args={[0.14, 0.025, 16.0]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.5} metalness={0.2} />
      </mesh>

      {[0.5, 6.5].map((zOff, i) => (
        <mesh key={`perg-col-${i}`} position={[platformXOffset + sideSign * 1.5, 1.8, zOff]}>
          <cylinderGeometry args={[0.065, 0.08, 3.2, 12]} />
          <meshStandardMaterial color="#70112C" metalness={0.8} roughness={0.28} envMap={envTex} />
        </mesh>
      ))}

      <mesh position={[platformXOffset + sideSign * 1.5, 3.4, 3.5]}>
        <boxGeometry args={[1.1, 0.06, 6.4]} />
        <meshPhysicalMaterial
          color="#FDA4AF"
          transparent
          opacity={0.18}
          depthWrite={false}
          roughness={0.08}
          reflectivity={0.9}
          envMap={envTex}
        />
      </mesh>

      {[2.5, 7.2].map((zLamp, idx) => (
        <group key={`lamp-${idx}`} position={[sideSign * 1.8, 0.28, zLamp]}>
          <mesh position={[0, 0.85, 0]}>
            <cylinderGeometry args={[0.035, 0.05, 1.7, 10]} />
            <meshStandardMaterial color="#1E293B" metalness={0.88} roughness={0.25} envMap={envTex} />
          </mesh>
          <mesh position={[0, 1.75, 0]}>
            <sphereGeometry args={[0.13, 14, 14]} />
            <meshBasicMaterial color="#FEF3C7" />
          </mesh>
          <mesh position={[0, 1.75, 0]}>
            <sphereGeometry args={[0.28, 14, 14]} />
            <meshBasicMaterial color="#FDE68A" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        </group>
      ))}

      <group
        position={[boardXOffset, boardY, boardZOffset]}
        rotation={[0, boardRotY, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.(station);
        }}
      >
        {[-1.0, 1.0].map((xPost) => (
          <mesh key={`sp-${xPost}`} position={[xPost, -0.68, 0]}>
            <cylinderGeometry args={[0.045, 0.055, 1.36, 12]} />
            <meshStandardMaterial color="#D97706" metalness={0.94} roughness={0.18} envMap={envTex} />
          </mesh>
        ))}

        <mesh castShadow>
          <boxGeometry args={[2.6, 1.55, 0.12]} />
          <meshPhysicalMaterial
            color="#1F0814"
            emissive="#BE123C"
            emissiveIntensity={0.35}
            metalness={0.75}
            roughness={0.2}
            clearcoat={0.85}
            envMap={envTex}
            side={THREE.DoubleSide}
          />
        </mesh>

        <mesh position={[0, 0, 0.065]}>
          <planeGeometry args={[2.42, 1.38]} />
          <meshBasicMaterial color="#0D060C" side={THREE.DoubleSide} />
        </mesh>

        <mesh position={[0, 0.82, 0]}>
          <boxGeometry args={[2.3, 0.06, 0.24]} />
          <meshStandardMaterial color="#70112C" metalness={0.88} roughness={0.22} envMap={envTex} />
        </mesh>
        <mesh position={[0, 0.78, 0]}>
          <boxGeometry args={[2.1, 0.025, 0.08]} />
          <meshBasicMaterial color="#FEF08A" />
        </mesh>

        <Text
          position={[0, 0.42, 0.08]}
          fontSize={0.13}
          letterSpacing={0.06}
          color="#FDA4AF"
          anchorX="center"
          anchorY="middle"
        >
          {`STATION 0${index + 1}  •  ${formattedDate.toUpperCase()}`}
        </Text>
        <Text
          position={[0, 0.06, 0.08]}
          fontSize={0.21}
          maxWidth={2.25}
          textAlign="center"
          color="#FFFFFF"
          anchorX="center"
          anchorY="middle"
        >
          {stationTitle}
        </Text>
        {captionSnippet && (
          <Text
            position={[0, -0.38, 0.08]}
            fontSize={0.11}
            maxWidth={2.2}
            textAlign="center"
            color="#FDE047"
            anchorX="center"
            anchorY="middle"
          >
            {captionSnippet}
          </Text>
        )}

        <group rotation={[0, Math.PI, 0]}>
          <mesh position={[0, 0, 0.065]}>
            <planeGeometry args={[2.42, 1.38]} />
            <meshBasicMaterial color="#0D060C" side={THREE.DoubleSide} />
          </mesh>
          <Text
            position={[0, 0.42, 0.08]}
            fontSize={0.13}
            letterSpacing={0.06}
            color="#FDA4AF"
            anchorX="center"
            anchorY="middle"
          >
            {`STATION 0${index + 1}  •  ${formattedDate.toUpperCase()}`}
          </Text>
          <Text
            position={[0, 0.06, 0.08]}
            fontSize={0.21}
            maxWidth={2.25}
            textAlign="center"
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            {stationTitle}
          </Text>
          {captionSnippet && (
            <Text
              position={[0, -0.38, 0.08]}
              fontSize={0.11}
              maxWidth={2.2}
              textAlign="center"
              color="#FDE047"
              anchorX="center"
              anchorY="middle"
            >
              {captionSnippet}
            </Text>
          )}
        </group>
      </group>
    </group>
  );
};

/**
 * Full World Landmarks, 4 Seasons & Weather Systems:
 * - Spring Greenery, Blossom Trees, Village Cottages, Flowing River & Waterfall (u: 0.00 - 0.20)
 * - Summer Mountains, Sacred Temples & Monsoon Rainfall (u: 0.20 - 0.42)
 * - Autumn Maple Forest & Falling Leaves (u: 0.42 - 0.56)
 * - Golden Desert Dunes, Oasis & Pyramids (u: 0.56 - 0.68)
 * - Winter Glacial Ice Mountains & Snowfall (u: 0.68 - 0.82)
 * - Starry Night City Skyline (u: 0.82 - 0.90)
 * - Marine Drive & Under-the-Sea Glass Tunnel (u: 0.90 - 1.00)
 */
const RealisticWorldBiomes = ({ curve, totalLength, envTex, cityWindowTex, isDark }) => {
  const rainRef = useRef(null);
  const snowRef = useRef(null);
  const leavesRef = useRef(null);
  const firefliesRef = useRef(null);
  const seaBubblesRef = useRef(null);
  const riverMatRef = useRef(null);

  const riverUniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  const biomeData = useMemo(() => {
    const up = new THREE.Vector3(0, 1, 0);
    const pointAtOffset = (u, sideDist, yOffset = 0) => {
      const p = curve.getPointAt(clampVal(u, 0.001, 0.999));
      const tang = curve.getTangentAt(clampVal(u, 0.001, 0.999)).normalize();
      const right = new THREE.Vector3().crossVectors(tang, up).normalize();
      const world = p.clone().addScaledVector(right, sideDist);
      world.y = yOffset;
      const rotY = Math.atan2(-tang.x, -tang.z);
      return { pos: [world.x, world.y, world.z], trackY: p.y, rotY };
    };

    // 1. Spring Greenery & Blossom Trees (u: 0.01 - 0.20)
    const blossomTrees = [];
    for (let i = 0; i < 18; i++) {
      const u = 0.01 + (i / 17) * 0.19;
      const side = i % 2 === 0 ? 1 : -1;
      const tree = pointAtOffset(u, side * (7.2 + (i % 4) * 2.5), -0.65);
      blossomTrees.push({
        pos: tree.pos,
        scale: 0.85 + (i % 3) * 0.28,
        foliageColor: i % 3 === 0 ? '#F9A8D4' : i % 3 === 1 ? '#3F7D47' : '#2E6F40',
      });
    }

    // 2. Cozy Countryside Village Cottages (u: 0.06 - 0.17)
    const villageHouses = [];
    for (let i = 0; i < 8; i++) {
      const u = 0.06 + (i / 7) * 0.11;
      const side = i % 2 === 0 ? 1 : -1;
      const h = pointAtOffset(u, side * (8.5 + (i % 3) * 3.2), -0.6);
      villageHouses.push({
        pos: h.pos,
        rotY: h.rotY + (side > 0 ? -0.4 : 0.4),
        scale: 0.9 + (i % 3) * 0.18,
        roofColor: i % 2 === 0 ? '#9F1239' : '#B45309',
      });
    }

    // Flowing River Ribbon alongside Spring Meadow (u: 0.03 - 0.21)
    const riverPts = [];
    for (let i = 0; i <= 40; i++) {
      const u = 0.03 + (i / 40) * 0.18;
      const p = curve.getPointAt(u);
      const tang = curve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tang, up).normalize();
      const rPt = p.clone().addScaledVector(right, -9.5 + Math.sin(i * 0.4) * 2.5);
      rPt.y = -0.48;
      riverPts.push(rPt);
    }
    const riverGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(riverPts), 60, 3.2, 6, false);
    riverGeo.scale(1, 0.06, 1);

    const waterfallAnchor = pointAtOffset(0.14, -15.5, -0.6);

    // 3. Sacred Golden-Spired Temples in Summer Mountains (u: 0.23 - 0.38)
    const temples = [];
    [
      [0.24, 11.5],
      [0.31, -12.0],
      [0.37, 12.2],
    ].forEach(([u, sideDist]) => {
      const t = pointAtOffset(u, sideDist, -0.5);
      temples.push({ pos: t.pos, rotY: t.rotY });
    });

    // 4. Autumn Maple Forest (u: 0.42 - 0.56)
    const autumnTrees = [];
    for (let i = 0; i < 18; i++) {
      const u = 0.42 + (i / 17) * 0.14;
      [-1, 1].forEach((side, sIdx) => {
        const t = pointAtOffset(u, side * (6.8 + ((i + sIdx) % 3) * 2.8), -0.55);
        const colors = ['#C2410C', '#B91C1C', '#D97706', '#EA580C'];
        autumnTrees.push({
          pos: t.pos,
          scale: 0.95 + ((i + sIdx) % 3) * 0.25,
          color: colors[(i + sIdx) % colors.length],
        });
      });
    }

    // 5. Desert Cacti & Pyramids (u: 0.56 - 0.68)
    const desertCacti = [];
    const desertPyramids = [];
    for (let i = 0; i < 12; i++) {
      const u = 0.56 + (i / 11) * 0.12;
      const side = i % 2 === 0 ? 1 : -1;
      const c = pointAtOffset(u, side * (6.8 + (i % 3) * 2.5), -0.6);
      desertCacti.push({ pos: c.pos, scale: 0.9 + (i % 3) * 0.22 });
      if (i === 3 || i === 8) {
        const pyr = pointAtOffset(u, -side * 19.0, -0.8);
        desertPyramids.push({ pos: pyr.pos, scale: i === 3 ? 1.2 : 0.9 });
      }
    }

    // 6. Winter Glacial Ice Spires & Frosted Pines (u: 0.68 - 0.82)
    const snowPines = [];
    const iceSpires = [];
    for (let i = 0; i < 18; i++) {
      const u = 0.68 + (i / 17) * 0.14;
      const pineSide = i % 2 === 0 ? 1 : -1;
      const pine = pointAtOffset(u, pineSide * (7.0 + (i % 3) * 2.4), -0.55);
      snowPines.push({ pos: pine.pos, scale: 0.95 + (i % 3) * 0.25 });
      if (i % 2 === 0) {
        const ice = pointAtOffset(u, -pineSide * (14.5 + (i % 3) * 3.5), -0.6);
        iceSpires.push({ pos: ice.pos, height: 10 + (i % 4) * 3.5, radius: 4.5 + (i % 3) * 1.5 });
      }
    }

    // 7. Illuminated Night City Skyline (u: 0.81 - 0.90)
    const cityBuildings = [];
    for (let i = 0; i < 22; i++) {
      const u = 0.81 + (i / 21) * 0.09;
      [-1, 1].forEach((side, sIdx) => {
        const dist = 8.2 + ((i + sIdx) % 3) * 4.5;
        const b = pointAtOffset(u, side * dist, -0.7);
        const h = 8.0 + ((i * 5 + sIdx * 3) % 14);
        cityBuildings.push({
          pos: [b.pos[0], h * 0.5 - 0.7, b.pos[2]],
          rotY: b.rotY,
          w: 2.6 + (i % 3) * 0.8,
          d: 2.8 + ((i + sIdx) % 2) * 0.9,
          h,
        });
      });
    }

    // 8. Overhead Railway Catenary Gantries (u: 0.02 - 0.89)
    const catenaryGantries = [];
    for (let i = 0; i < 26; i++) {
      const u = 0.02 + (i / 25) * 0.86;
      const p = curve.getPointAt(u);
      const tang = curve.getTangentAt(u).normalize();
      const rotY = Math.atan2(-tang.x, -tang.z);
      catenaryGantries.push({ pos: [p.x, p.y, p.z], rotY });
    }

    // 9. Under-the-Sea Glass Tunnel & Marine Drive (u: 0.90 - 0.99)
    const seaArches = [];
    const coralClusters = [];
    for (let i = 0; i < 14; i++) {
      const u = 0.905 + (i / 13) * 0.085;
      const p = curve.getPointAt(u);
      const tang = curve.getTangentAt(u).normalize();
      const rotY = Math.atan2(-tang.x, -tang.z);
      seaArches.push({ pos: [p.x, p.y, p.z], rotY });

      const side = i % 2 === 0 ? 1 : -1;
      const coral = pointAtOffset(u, side * (5.8 + (i % 3) * 2.2), -1.7);
      const coralColors = ['#FB7185', '#22D3EE', '#F472B6', '#FACC15', '#A855F7'];
      coralClusters.push({
        pos: coral.pos,
        color: coralColors[i % coralColors.length],
        scale: 0.9 + (i % 3) * 0.3,
      });
    }

    const seaCenter = curve.getPointAt(0.95);

    // Particle Buffers
    // Rainfall (u: 0.27 - 0.43)
    const rainCount = 520;
    const rainPositions = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      const u = 0.27 + (i / rainCount) * 0.16;
      const p = curve.getPointAt(u);
      rainPositions[i * 3] = p.x + ((i * 19) % 36) - 18;
      rainPositions[i * 3 + 1] = ((i * 11) % 18) + 0.5;
      rainPositions[i * 3 + 2] = p.z + ((i * 7) % 16) - 8;
    }

    // Falling Autumn Leaves (u: 0.42 - 0.56)
    const leafCount = 320;
    const leafPositions = new Float32Array(leafCount * 3);
    for (let i = 0; i < leafCount; i++) {
      const u = 0.42 + (i / leafCount) * 0.14;
      const p = curve.getPointAt(u);
      leafPositions[i * 3] = p.x + ((i * 19) % 30) - 15;
      leafPositions[i * 3 + 1] = ((i * 11) % 14) + 0.5;
      leafPositions[i * 3 + 2] = p.z + ((i * 5) % 12) - 6;
    }

    // Snowfall (u: 0.68 - 0.82)
    const snowCount = 480;
    const snowPositions = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      const u = 0.68 + (i / snowCount) * 0.14;
      const p = curve.getPointAt(u);
      snowPositions[i * 3] = p.x + ((i * 17) % 36) - 18;
      snowPositions[i * 3 + 1] = ((i * 13) % 18) + 0.5;
      snowPositions[i * 3 + 2] = p.z + ((i * 7) % 16) - 8;
    }

    // Fireflies & Warm Motes
    const moteCount = 320;
    const motePositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      const u = (i / moteCount) * 0.98 + 0.01;
      const p = curve.getPointAt(u);
      motePositions[i * 3] = p.x + ((i * 23) % 28) - 14;
      motePositions[i * 3 + 1] = p.y + ((i * 7) % 7) + 0.6;
      motePositions[i * 3 + 2] = p.z + ((i * 13) % 14) - 7;
    }

    // Sea Bubbles (u: 0.90 - 0.99)
    const bubbleCount = 180;
    const bubblePositions = new Float32Array(bubbleCount * 3);
    for (let i = 0; i < bubbleCount; i++) {
      const u = 0.90 + (i / bubbleCount) * 0.09;
      const p = curve.getPointAt(u);
      bubblePositions[i * 3] = p.x + ((i * 13) % 22) - 11;
      bubblePositions[i * 3 + 1] = ((i * 9) % 10) - 1.2;
      bubblePositions[i * 3 + 2] = p.z + ((i * 7) % 10) - 5;
    }

    return {
      blossomTrees,
      villageHouses,
      riverGeo,
      waterfallAnchor,
      temples,
      autumnTrees,
      desertCacti,
      desertPyramids,
      snowPines,
      iceSpires,
      cityBuildings,
      catenaryGantries,
      seaArches,
      coralClusters,
      seaCenter,
      rainPositions,
      leafPositions,
      snowPositions,
      motePositions,
      bubblePositions,
    };
  }, [curve, totalLength]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;

    if (riverMatRef.current) {
      riverMatRef.current.uniforms.uTime.value = t;
    }

    if (rainRef.current) {
      const arr = rainRef.current.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 15.0;
        if (arr[i + 1] < 0) arr[i + 1] = 18;
      }
      rainRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (snowRef.current) {
      const arr = snowRef.current.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 2.7;
        arr[i] += Math.sin(t * 1.5 + i) * dt * 0.4;
        if (arr[i + 1] < 0) arr[i + 1] = 18;
      }
      snowRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (leavesRef.current) {
      const arr = leavesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= dt * 1.8;
        arr[i] += Math.cos(t * 2.1 + i) * dt * 0.85;
        if (arr[i + 1] < 0) arr[i + 1] = 14;
      }
      leavesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (firefliesRef.current) {
      const arr = firefliesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += Math.sin(t * 1.4 + i) * dt * 0.35;
      }
      firefliesRef.current.geometry.attributes.position.needsUpdate = true;
    }

    if (seaBubblesRef.current) {
      const arr = seaBubblesRef.current.geometry.attributes.position.array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] += dt * 1.9;
        if (arr[i + 1] > 7.5) arr[i + 1] = -1.2;
      }
      seaBubblesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Overhead Catenary Gantries */}
      {biomeData.catenaryGantries.map((g, i) => (
        <group key={`gantry-${i}`} position={g.pos} rotation={[0, g.rotY, 0]}>
          <mesh position={[-1.55, 1.35, 0]}>
            <boxGeometry args={[0.1, 3.0, 0.1]} />
            <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.35} envMap={envTex} />
          </mesh>
          <mesh position={[-0.7, 2.75, 0]}>
            <boxGeometry args={[1.8, 0.08, 0.08]} />
            <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* Spring Blossom & Meadow Trees */}
      {biomeData.blossomTrees.map((t, i) => (
        <group key={`bt-${i}`} position={t.pos} scale={t.scale}>
          <mesh position={[0, 1.0, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.26, 2.0, 8]} />
            <meshStandardMaterial color="#4A2E1B" roughness={0.92} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <dodecahedronGeometry args={[1.2, 1]} />
            <meshStandardMaterial color={t.foliageColor} roughness={0.78} />
          </mesh>
          <mesh position={[0.65, 2.05, 0.45]} castShadow>
            <dodecahedronGeometry args={[0.82, 1]} />
            <meshStandardMaterial color={t.foliageColor} roughness={0.78} />
          </mesh>
        </group>
      ))}

      {/* Countryside Village Cottages */}
      {biomeData.villageHouses.map((h, i) => (
        <group key={`village-${i}`} position={h.pos} rotation={[0, h.rotY, 0]} scale={h.scale}>
          <mesh position={[0, 0.9, 0]} castShadow>
            <boxGeometry args={[2.2, 1.8, 2.6]} />
            <meshStandardMaterial color="#E7E5E4" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.35, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[1.95, 1.35, 4]} />
            <meshStandardMaterial color={h.roofColor} roughness={0.75} />
          </mesh>
          {/* Warm glowing cottage windows */}
          {[-0.55, 0.55].map((zW) => (
            <mesh key={`vw-${zW}`} position={[-1.12, 1.0, zW]}>
              <boxGeometry args={[0.04, 0.5, 0.45]} />
              <meshBasicMaterial color="#FDE68A" />
            </mesh>
          ))}
        </group>
      ))}

      {/* Flowing Spring River */}
      <mesh geometry={biomeData.riverGeo}>
        <shaderMaterial
          ref={riverMatRef}
          transparent
          uniforms={riverUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec2 vUv;
            void main() {
              float wave = sin(vUv.x * 45.0 - uTime * 3.5) * 0.5 + 0.5;
              vec3 col = mix(vec3(0.06, 0.48, 0.62), vec3(0.45, 0.85, 0.95), wave * 0.35);
              gl_FragColor = vec4(col, 0.82);
            }
          `}
        />
      </mesh>

      {/* Cascading Waterfall */}
      <RealisticWaterfall position={biomeData.waterfallAnchor.pos} />

      {/* Sacred Golden-Spired Temples (Summer Mountains) */}
      {biomeData.temples.map((tp, i) => (
        <group key={`temple-${i}`} position={tp.pos} rotation={[0, tp.rotY, 0]}>
          {/* Stepped Stone Plinth */}
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[4.4, 0.8, 4.4]} />
            <meshStandardMaterial color="#D6D3D1" roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.6, 0]} castShadow>
            <boxGeometry args={[3.2, 1.6, 3.2]} />
            <meshStandardMaterial color="#F59E0B" roughness={0.55} metalness={0.35} />
          </mesh>
          {/* Tiered Shikhara / Pagoda Spires */}
          <mesh position={[0, 3.2, 0]} castShadow>
            <coneGeometry args={[2.1, 2.0, 4]} />
            <meshStandardMaterial color="#D97706" metalness={0.75} roughness={0.28} envMap={envTex} />
          </mesh>
          <mesh position={[0, 4.5, 0]}>
            <coneGeometry args={[1.1, 1.4, 4]} />
            <meshStandardMaterial color="#FDE047" metalness={0.9} roughness={0.2} envMap={envTex} />
          </mesh>
          {/* Glowing Temple Sanctum Light */}
          <mesh position={[0, 1.4, 0]}>
            <boxGeometry args={[3.26, 0.65, 1.1]} />
            <meshBasicMaterial color="#FEF08A" />
          </mesh>
        </group>
      ))}

      {/* Monsoon Rainfall Particles */}
      <points ref={rainRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={biomeData.rainPositions.length / 3}
            array={biomeData.rainPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#BAE6FD" size={0.18} transparent opacity={0.72} />
      </points>

      {/* Autumn Maple Forest & Falling Leaves */}
      {biomeData.autumnTrees.map((t, i) => (
        <group key={`at-${i}`} position={t.pos} scale={t.scale}>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.16, 0.26, 2.0, 8]} />
            <meshStandardMaterial color="#3E2312" roughness={0.92} />
          </mesh>
          <mesh position={[0, 2.4, 0]} castShadow>
            <dodecahedronGeometry args={[1.3, 1]} />
            <meshStandardMaterial color={t.color} roughness={0.75} />
          </mesh>
        </group>
      ))}
      <points ref={leavesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={biomeData.leafPositions.length / 3}
            array={biomeData.leafPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#EA580C" size={0.32} transparent opacity={0.9} />
      </points>

      {/* Golden Desert Cacti & Pyramids */}
      {biomeData.desertCacti.map((c, i) => (
        <group key={`dc-${i}`} position={c.pos} scale={c.scale}>
          <mesh position={[0, 1.2, 0]}>
            <cylinderGeometry args={[0.18, 0.22, 2.4, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.85} />
          </mesh>
          <mesh position={[0.4, 1.4, 0]} rotation={[0, 0, -0.5]}>
            <cylinderGeometry args={[0.12, 0.14, 0.9, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.85} />
          </mesh>
          <mesh position={[-0.4, 1.1, 0]} rotation={[0, 0, 0.5]}>
            <cylinderGeometry args={[0.12, 0.14, 0.8, 8]} />
            <meshStandardMaterial color="#166534" roughness={0.85} />
          </mesh>
        </group>
      ))}
      {biomeData.desertPyramids.map((p, i) => (
        <mesh
          key={`pyr-${i}`}
          position={[p.pos[0], 5.5 * p.scale - 0.8, p.pos[2]]}
          rotation={[0, Math.PI / 4, 0]}
          castShadow
        >
          <coneGeometry args={[9.5 * p.scale, 11.0 * p.scale, 4]} />
          <meshStandardMaterial color="#D97706" roughness={0.78} />
        </mesh>
      ))}

      {/* Winter Glacial Ice Mountains & Frosted Pines + Snowfall */}
      {biomeData.iceSpires.map((ice, i) => (
        <mesh
          key={`ice-${i}`}
          position={[ice.pos[0], ice.height * 0.45 - 0.8, ice.pos[2]]}
        >
          <coneGeometry args={[ice.radius, ice.height, 6]} />
          <meshPhysicalMaterial
            color="#BAE6FD"
            roughness={0.18}
            metalness={0.15}
            clearcoat={0.8}
            envMap={envTex}
            envMapIntensity={1.4}
          />
        </mesh>
      ))}
      {biomeData.snowPines.map((p, i) => (
        <group key={`sp-${i}`} position={p.pos} scale={p.scale}>
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[0.14, 0.22, 1.4, 7]} />
            <meshStandardMaterial color="#3B2314" roughness={0.92} />
          </mesh>
          <mesh position={[0, 1.65, 0]} castShadow>
            <coneGeometry args={[1.25, 1.4, 9]} />
            <meshStandardMaterial color="#134E4A" roughness={0.85} />
          </mesh>
          <mesh position={[0, 2.35, 0]} castShadow>
            <coneGeometry args={[1.0, 1.3, 9]} />
            <meshStandardMaterial color="#115E59" roughness={0.85} />
          </mesh>
          <mesh position={[0, 3.05, 0]}>
            <coneGeometry args={[0.72, 1.2, 9]} />
            <meshStandardMaterial color="#F1F5F9" roughness={0.55} />
          </mesh>
        </group>
      ))}
      <points ref={snowRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={biomeData.snowPositions.length / 3}
            array={biomeData.snowPositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#FFFFFF" size={0.28} transparent opacity={0.88} />
      </points>

      {/* Illuminated Night City Skyline */}
      {biomeData.cityBuildings.map((b, i) => (
        <group key={`city-b-${i}`} position={b.pos} rotation={[0, b.rotY, 0]}>
          <mesh castShadow>
            <boxGeometry args={[b.w, b.h, b.d]} />
            <meshStandardMaterial map={cityWindowTex} roughness={0.45} metalness={0.4} envMap={envTex} />
          </mesh>
          {/* Rooftop Aviation Beacon */}
          <mesh position={[0, b.h * 0.5 + 0.25, 0]}>
            <sphereGeometry args={[0.14, 8, 8]} />
            <meshBasicMaterial color={i % 2 === 0 ? '#FF1E42' : '#38BDF8'} />
          </mesh>
        </group>
      ))}

      {/* Moonlit Under-the-Sea Ocean & Glass Tunnel */}
      <RealisticOceanSurface center={biomeData.seaCenter} isDark={isDark} />

      {biomeData.seaArches.map((a, idx) => (
        <group key={`sea-arch-${idx}`} position={a.pos} rotation={[0, a.rotY, 0]}>
          <mesh>
            <torusGeometry args={[3.9, 0.08, 10, 28, Math.PI]} />
            <meshStandardMaterial color="#67E8F9" metalness={0.85} roughness={0.18} envMap={envTex} />
          </mesh>
          <mesh position={[0, 1.9, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.85, 3.85, 2.2, 20, 1, true, -Math.PI / 2, Math.PI]} />
            <meshPhysicalMaterial
              color="#A5F3FC"
              transparent
              opacity={0.12}
              roughness={0.05}
              reflectivity={0.9}
              envMap={envTex}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          {[-2.2, 2.2].map((xProm) => (
            <mesh key={`prom-${xProm}`} position={[xProm, 0.35, 0]}>
              <sphereGeometry args={[0.12, 10, 10]} />
              <meshBasicMaterial color="#FEF08A" />
            </mesh>
          ))}
        </group>
      ))}

      {biomeData.coralClusters.map((c, idx) => (
        <group key={`coral-${idx}`} position={c.pos} scale={c.scale}>
          <mesh position={[0, 0.8, 0]}>
            <dodecahedronGeometry args={[0.9, 1]} />
            <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.28} roughness={0.6} />
          </mesh>
        </group>
      ))}

      <points ref={seaBubblesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={biomeData.bubblePositions.length / 3}
            array={biomeData.bubblePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#A5F3FC" size={0.24} transparent opacity={0.8} />
      </points>

      <points ref={firefliesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={biomeData.motePositions.length / 3}
            array={biomeData.motePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial color="#FDE68A" size={0.22} transparent opacity={0.8} />
      </points>
    </group>
  );
};

const TrainScene3D = ({
  stations = [],
  targetProgressRef,
  currentProgressRef,
  cameraModeRef,
  onEffectiveModeChange,
  setActiveStationIdx,
  onOpenPolaroid,
  amoledMode = false,
  proximityGainRef,
}) => {
  const { camera, size, scene } = useThree();
  const trainGroupRef = useRef(null);
  const wheelsRef = useRef(null);
  const fogRef = useRef(null);
  const bgColorRef = useRef(null);
  const dirLightRef = useRef(null);
  const ambLightRef = useRef(null);
  const lookAtVecRef = useRef(new THREE.Vector3(0, 1, 0));
  const lastReportedIdxRef = useRef(-1);
  const lastReportedModeRef = useRef('FPP');

  const assets = useProceduralAssets(amoledMode);

  // Reusable colors for zero-GC time-of-day interpolation inside useFrame
  const timeColors = useMemo(
    () => ({
      fogMorn: new THREE.Color('#F9A8B8'),
      fogAft: new THREE.Color('#93C5FD'),
      fogRain: new THREE.Color('#64748B'),
      fogEve: new THREE.Color('#E1707E'),
      fogNight: new THREE.Color('#090E1C'),
      sunMorn: new THREE.Color('#FFE4B5'),
      sunAft: new THREE.Color('#FFFBEB'),
      sunEve: new THREE.Color('#FDBA74'),
      sunNight: new THREE.Color('#93C5FD'),
      tmpFog: new THREE.Color(),
      tmpSun: new THREE.Color(),
    }),
    []
  );

  useEffect(() => {
    scene.environment = assets.envTex;
    return () => {
      if (scene.environment === assets.envTex) {
        scene.environment = null;
      }
    };
  }, [scene, assets.envTex]);

  const {
    curve,
    totalLength,
    stationPositions,
    sleepers,
    viaductPillars,
    ballastGeo,
    leftRailGeo,
    rightRailGeo,
    catenaryWireGeo,
  } = useMemo(() => {
    const count = Math.max(stations.length, 3);
    const trackLen = count * 84;
    const ctrlPoints = [];
    const numCtrl = Math.max(28, count * 5);

    for (let i = 0; i <= numCtrl; i++) {
      const u = i / numCtrl;
      const z = -u * trackLen;

      const x =
        Math.sin(u * Math.PI * 5.0) * 16 +
        Math.cos(u * Math.PI * 2.5) * 7 +
        Math.sin(u * Math.PI * 10.0) * 2.6;

      const mountainClimb = Math.exp(-Math.pow((u - 0.32) / 0.12, 2)) * 5.8;
      const icePeak = Math.exp(-Math.pow((u - 0.75) / 0.09, 2)) * 4.8;
      const rollerRiddle = Math.pow(Math.sin(u * Math.PI * 6.0), 2) * 1.75;
      const seaDip = u > 0.90 ? -0.35 : 0;

      const y = 0.65 + mountainClimb + icePeak + rollerRiddle + seaDip;
      ctrlPoints.push(new THREE.Vector3(x, y, z));
    }

    const trackCurve = new THREE.CatmullRomCurve3(ctrlPoints);
    const up = new THREE.Vector3(0, 1, 0);

    const sPositions = stations.map((_, idx) => {
      const t = stations.length <= 1 ? 0.2 : 0.06 + (idx / (stations.length - 1)) * 0.88;
      const pos = trackCurve.getPointAt(t);
      const tangent = trackCurve.getTangentAt(t).normalize();
      const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
      const rotY = Math.atan2(-tangent.x, -tangent.z);
      const sideSign = idx % 2 === 0 ? 1 : -1;
      const signboardWorldPos = pos
        .clone()
        .addScaledVector(tangent, 3.8)
        .addScaledVector(right, sideSign * 3.4)
        .add(new THREE.Vector3(0, 1.7, 0));

      return { t, pos, tangent, right, rotY, sideSign, signboardWorldPos };
    });

    const samples = 400;
    const ballastPts = [];
    const leftPts = [];
    const rightPts = [];
    const catPts = [];

    for (let i = 0; i <= samples; i++) {
      const u = i / samples;
      const p = trackCurve.getPointAt(u);
      const tang = trackCurve.getTangentAt(u).normalize();
      const right = new THREE.Vector3().crossVectors(tang, up).normalize();

      ballastPts.push(p.clone().add(new THREE.Vector3(0, -0.14, 0)));
      leftPts.push(p.clone().addScaledVector(right, -0.58).add(new THREE.Vector3(0, 0.07, 0)));
      rightPts.push(p.clone().addScaledVector(right, 0.58).add(new THREE.Vector3(0, 0.07, 0)));
      if (u <= 0.89) {
        catPts.push(p.clone().add(new THREE.Vector3(0, 2.7, 0)));
      }
    }

    const ballastCurve = new THREE.CatmullRomCurve3(ballastPts);
    const leftCurve = new THREE.CatmullRomCurve3(leftPts);
    const rightCurve = new THREE.CatmullRomCurve3(rightPts);
    const catCurve = new THREE.CatmullRomCurve3(catPts);

    const tieList = [];
    const totalTies = Math.max(640, count * 80);
    for (let i = 0; i <= totalTies; i++) {
      const u = i / totalTies;
      const p = trackCurve.getPointAt(u);
      const tang = trackCurve.getTangentAt(u).normalize();
      const rotY = Math.atan2(tang.x, tang.z);
      const pitchX = -Math.asin(clampVal(tang.y, -0.95, 0.95));
      tieList.push({ pos: [p.x, p.y + 0.01, p.z], rot: [pitchX, rotY, 0] });
    }

    const pillars = [];
    const totalPillars = 115;
    for (let i = 0; i <= totalPillars; i++) {
      const u = i / totalPillars;
      const p = trackCurve.getPointAt(u);
      const h = p.y + 1.2;
      if (h > 0.6) {
        pillars.push({
          pos: [p.x, p.y - h * 0.5 - 0.15, p.z],
          height: h,
        });
      }
    }

    return {
      curve: trackCurve,
      totalLength: trackLen,
      stationPositions: sPositions,
      sleepers: tieList,
      viaductPillars: pillars,
      ballastGeo: new THREE.TubeGeometry(ballastCurve, 360, 0.95, 8, false),
      leftRailGeo: new THREE.TubeGeometry(leftCurve, 360, 0.058, 8, false),
      rightRailGeo: new THREE.TubeGeometry(rightCurve, 360, 0.058, 8, false),
      catenaryWireGeo: new THREE.TubeGeometry(catCurve, 280, 0.018, 5, false),
    };
  }, [stations]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const prevT = currentProgressRef.current;
    const targetT = clampVal(targetProgressRef.current, 0.02, 0.98);
    const nextT = THREE.MathUtils.lerp(prevT, targetT, Math.min(1, dt * 7.5));
    currentProgressRef.current = nextT;

    // Update Time-of-Day Fog & Sun/Moon Lighting smoothly
    const p = clampVal(nextT, 0, 1);
    const wMorn = 1 - smoothstep(0.16, 0.30, p);
    const wAft = smoothstep(0.16, 0.30, p) * (1 - smoothstep(0.42, 0.56, p));
    const wEve = smoothstep(0.42, 0.56, p) * (1 - smoothstep(0.68, 0.82, p));
    const wNight = smoothstep(0.68, 0.82, p);
    const rainMood = smoothstep(0.26, 0.34, p) * (1 - smoothstep(0.40, 0.48, p));

    timeColors.tmpFog.setRGB(
      timeColors.fogMorn.r * wMorn +
        timeColors.fogAft.r * wAft * (1 - rainMood * 0.7) +
        timeColors.fogRain.r * wAft * rainMood * 0.7 +
        timeColors.fogEve.r * wEve +
        timeColors.fogNight.r * wNight,
      timeColors.fogMorn.g * wMorn +
        timeColors.fogAft.g * wAft * (1 - rainMood * 0.7) +
        timeColors.fogRain.g * wAft * rainMood * 0.7 +
        timeColors.fogEve.g * wEve +
        timeColors.fogNight.g * wNight,
      timeColors.fogMorn.b * wMorn +
        timeColors.fogAft.b * wAft * (1 - rainMood * 0.7) +
        timeColors.fogRain.b * wAft * rainMood * 0.7 +
        timeColors.fogEve.b * wEve +
        timeColors.fogNight.b * wNight
    );

    if (fogRef.current) fogRef.current.color.copy(timeColors.tmpFog);
    if (bgColorRef.current) bgColorRef.current.copy(timeColors.tmpFog);

    timeColors.tmpSun.setRGB(
      timeColors.sunMorn.r * wMorn +
        timeColors.sunAft.r * wAft +
        timeColors.sunEve.r * wEve +
        timeColors.sunNight.r * wNight,
      timeColors.sunMorn.g * wMorn +
        timeColors.sunAft.g * wAft +
        timeColors.sunEve.g * wEve +
        timeColors.sunNight.g * wNight,
      timeColors.sunMorn.b * wMorn +
        timeColors.sunAft.b * wAft +
        timeColors.sunEve.b * wEve +
        timeColors.sunNight.b * wNight
    );

    if (dirLightRef.current) {
      dirLightRef.current.color.copy(timeColors.tmpSun);
      dirLightRef.current.intensity = (2.1 - rainMood * 0.6) * (1 - wNight * 0.65);
    }
    if (ambLightRef.current) {
      ambLightRef.current.intensity = (amoledMode ? 0.38 : 0.55) * (1 - wNight * 0.35);
    }

    const trainPos = curve.getPointAt(clampVal(nextT, 0.001, 0.999));
    const tangent = curve.getTangentAt(clampVal(nextT, 0.001, 0.999)).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const rightVec = new THREE.Vector3().crossVectors(tangent, up).normalize();

    if (trainGroupRef.current) {
      trainGroupRef.current.position.copy(trainPos);
      trainGroupRef.current.lookAt(trainPos.clone().add(tangent));
    }

    if (wheelsRef.current) {
      const stepDist = (nextT - prevT) * totalLength;
      wheelsRef.current.children.forEach((axle) => {
        axle.rotation.x -= stepDist / 0.19;
      });
    }

    const count = stations.length;
    let nearestIdx = 0;
    let minAbsDiff = Infinity;
    let nearestStationInfo = null;

    for (let i = 0; i < stationPositions.length; i++) {
      const diff = Math.abs(nextT - stationPositions[i].t);
      if (diff < minAbsDiff) {
        minAbsDiff = diff;
        nearestIdx = i;
        nearestStationInfo = stationPositions[i];
      }
    }

    if (nearestIdx !== lastReportedIdxRef.current) {
      lastReportedIdxRef.current = nearestIdx;
      setActiveStationIdx(nearestIdx);
    }

    if (proximityGainRef?.current) {
      const stepSpan = count > 1 ? 0.88 / (count - 1) : 0.25;
      const prox = clampVal(1 - minAbsDiff / (stepSpan * 0.5), 0, 1);
      proximityGainRef.current.gain.value = 0.015 + prox * 0.04;
    }

    const requestedMode = cameraModeRef?.current || 'AUTO';
    let fppWeight = 0;
    let stationLookWeight = 0;

    if (nearestStationInfo) {
      const stepSpan = count > 1 ? 0.88 / (count - 1) : 0.3;
      const signedSteps = (nextT - nearestStationInfo.t) / stepSpan;

      if (requestedMode === 'FPP') {
        fppWeight = 1;
      } else {
        fppWeight = 0;
      }

      if (signedSteps >= -0.32 && signedSteps < -0.05) {
        stationLookWeight = smoothstep(-0.32, -0.05, signedSteps);
      } else if (signedSteps >= -0.05 && signedSteps <= 0.05) {
        stationLookWeight = 1.0;
      } else if (signedSteps > 0.05 && signedSteps <= 0.28) {
        stationLookWeight = 1 - smoothstep(0.05, 0.28, signedSteps);
      }
    } else if (requestedMode === 'FPP') {
      fppWeight = 1;
    }

    const isMobile =
      (size?.width || (typeof window !== 'undefined' ? window.innerWidth : 1024)) < 768;
    const targetFov = isMobile ? 58 : 50;
    if (Math.abs(camera.fov - targetFov) > 0.5) {
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    const effectiveLabel = fppWeight > 0.5 ? 'FPP' : 'TPP';
    if (effectiveLabel !== lastReportedModeRef.current) {
      lastReportedModeRef.current = effectiveLabel;
      onEffectiveModeChange?.(effectiveLabel);
    }

    const sideSign = nearestStationInfo?.sideSign || 1;

    const fppPos = trainPos
      .clone()
      .addScaledVector(tangent, 0.8)
      .add(new THREE.Vector3(0, 1.05, 0));

    const aheadTrackPoint = curve
      .getPointAt(clampVal(nextT + 0.04, 0.001, 0.999))
      .add(new THREE.Vector3(0, 0.5, 0));

    const fppLook = nearestStationInfo
      ? aheadTrackPoint.clone().lerp(nearestStationInfo.signboardWorldPos, stationLookWeight)
      : aheadTrackPoint;

    const defaultTppPos = trainPos
      .clone()
      .addScaledVector(tangent, -10.5)
      .addScaledVector(rightVec, sideSign * 3.2)
      .add(new THREE.Vector3(0, 3.6, 0));

    const defaultTppLook = curve
      .getPointAt(clampVal(nextT + 0.025, 0.001, 0.999))
      .add(new THREE.Vector3(0, 0.75, 0));

    const stationTppPos = nearestStationInfo
      ? nearestStationInfo.pos
          .clone()
          .addScaledVector(nearestStationInfo.tangent, 7.2)
          .addScaledVector(nearestStationInfo.right, sideSign * 2.0)
          .add(new THREE.Vector3(0, 2.1, 0))
      : defaultTppPos;

    const stationTppLook = nearestStationInfo
      ? nearestStationInfo.signboardWorldPos.clone().add(new THREE.Vector3(0, -0.05, 0))
      : defaultTppLook;

    const tppPos = defaultTppPos.lerp(stationTppPos, stationLookWeight);
    const tppLook = defaultTppLook.lerp(stationTppLook, stationLookWeight);

    const desiredCamPos = tppPos.lerp(fppPos, fppWeight);
    const desiredLookAt = tppLook.lerp(fppLook, fppWeight);

    camera.position.lerp(desiredCamPos, Math.min(1, dt * 6.5));
    lookAtVecRef.current.lerp(desiredLookAt, Math.min(1, dt * 6.5));
    camera.lookAt(lookAtVecRef.current);
  });

  return (
    <>
      <color ref={bgColorRef} attach="background" args={['#F9A8B8']} />
      <fogExp2 ref={fogRef} attach="fog" args={['#F9A8B8', 0.0046]} />

      {/* Dynamic 24-Hour Time-of-Day Sky Dome */}
      <DynamicTimeSkyDome progressRef={currentProgressRef} isDark={amoledMode} />

      <ambientLight ref={ambLightRef} intensity={0.55} color="#FFD8C4" />
      <directionalLight
        ref={dirLightRef}
        position={[35, 42, -55]}
        intensity={2.1}
        color="#FFE0A3"
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={5}
        shadow-camera-far={220}
      />
      <hemisphereLight args={['#FDBA74', '#1F2937', 0.55]} />

      <RealisticTerrain
        curve={curve}
        totalLength={totalLength}
        detailTex={assets.terrainDetailTex}
        isDark={amoledMode}
      />

      <mesh geometry={ballastGeo} receiveShadow>
        <meshStandardMaterial map={assets.gravelTex} roughness={0.95} metalness={0.05} />
      </mesh>

      {viaductPillars.map((pil, idx) => (
        <mesh key={`vpil-${idx}`} position={pil.pos} castShadow receiveShadow>
          <boxGeometry args={[1.15, pil.height, 0.95]} />
          <meshStandardMaterial color="#525866" roughness={0.88} metalness={0.08} />
        </mesh>
      ))}

      <mesh geometry={leftRailGeo}>
        <meshStandardMaterial
          color="#E2E8F0"
          metalness={0.95}
          roughness={0.16}
          envMap={assets.envTex}
          envMapIntensity={1.6}
        />
      </mesh>
      <mesh geometry={rightRailGeo}>
        <meshStandardMaterial
          color="#E2E8F0"
          metalness={0.95}
          roughness={0.16}
          envMap={assets.envTex}
          envMapIntensity={1.6}
        />
      </mesh>

      <mesh geometry={catenaryWireGeo}>
        <meshStandardMaterial color="#94A3B8" metalness={0.85} roughness={0.25} />
      </mesh>

      {sleepers.map((tie, idx) => (
        <mesh key={`tie-${idx}`} position={tie.pos} rotation={tie.rot} receiveShadow>
          <boxGeometry args={[1.85, 0.09, 0.28]} />
          <meshStandardMaterial map={assets.woodTex} roughness={0.85} />
        </mesh>
      ))}

      <RealisticWorldBiomes
        curve={curve}
        totalLength={totalLength}
        envTex={assets.envTex}
        cityWindowTex={assets.cityWindowTex}
        isDark={amoledMode}
      />

      <group ref={trainGroupRef}>
        <group rotation={[0, Math.PI, 0]}>
          <ExpressTrainModel isDark={amoledMode} wheelsRef={wheelsRef} envTex={assets.envTex} />
        </group>
      </group>

      {stations.map((station, idx) => {
        const info = stationPositions[idx];
        if (!info) return null;
        return (
          <StationPlatform3D
            key={station._id || idx}
            station={station}
            index={idx}
            position={info.pos}
            rotY={info.rotY}
            sideSign={info.sideSign}
            onSelect={onOpenPolaroid}
            tileTex={assets.tileTex}
            envTex={assets.envTex}
          />
        );
      })}
    </>
  );
};

export default TrainScene3D;
