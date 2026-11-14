import { clamp, lerp } from '../../utils/coordinateMath';
import { arcadeSfx } from './arcadeAudio';

const triggerHaptic = (ms) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
};

export const spawnSparks = (particles, x, y, color, count = 10, speedScale = 0.45) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (0.15 + Math.random() * 0.85) * speedScale;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: 1.8 + Math.random() * 1.4,
      size: 2 + Math.random() * 2.5,
      color,
    });
  }
  if (particles.length > 90) {
    particles.splice(0, particles.length - 90);
  }
};

export const updateAndDrawParticles = (ctx, particles, W, H, dt) => {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= p.decay * dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    ctx.globalAlpha = clamp(p.life, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x * W, p.y * H, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
};

/**
 * GAME 1: NEON AIR HOCKEY (First to 7)
 */
export const stepAndDrawHockey = ({
  ctx,
  st,
  W,
  H,
  dt,
  timestamp,
  isSolo,
  onPhaseChange,
}) => {
  const aspect = W / Math.max(H, 1);
  const minDim = Math.min(W, H);
  const paddleR = 0.068;
  const puckR = 0.038;
  const goalHalfWidth = 0.22;
  const goalLeft = 0.5 - goalHalfWidth;
  const goalRight = 0.5 + goalHalfWidth;

  // Draw crisp rink lines, corner arcs & glowing goal mouths
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, W - 20, H - 20);

  ctx.beginPath();
  ctx.moveTo(10, H / 2);
  ctx.lineTo(W - 10, H / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, H / 2, minDim * 0.14, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(W / 2, H / 2, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 240, 255, 0.35)';
  ctx.fill();

  // Top goal (Partner / AI)
  ctx.strokeStyle = '#FF003C';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(goalLeft * W, 6);
  ctx.lineTo(goalRight * W, 6);
  ctx.stroke();

  // Bottom goal (You)
  ctx.strokeStyle = '#00F0FF';
  ctx.beginPath();
  ctx.moveTo(goalLeft * W, H - 6);
  ctx.lineTo(goalRight * W, H - 6);
  ctx.stroke();

  if (st.phase === 'playing') {
    // Measure player paddle velocity for authentic strike transfer
    const rawMyVx = (st.myNx - st.prevMyNx) / Math.max(dt, 0.008);
    const rawMyVy = (st.myNy - st.prevMyNy) / Math.max(dt, 0.008);
    st.myVx = lerp(st.myVx, clamp(rawMyVx, -2.6, 2.6), 0.45);
    st.myVy = lerp(st.myVy, clamp(rawMyVy, -2.6, 2.6), 0.45);
    st.prevMyNx = st.myNx;
    st.prevMyNy = st.myNy;

    // Predictive AI when playing solo
    if (isSolo) {
      const puckHeadingTop = st.puckVy < 0 || st.puckY < 0.48;
      const targetX = puckHeadingTop
        ? clamp(st.puckX + st.puckVx * 0.16, 0.14, 0.86)
        : 0.5 + Math.sin(timestamp * 0.0022) * 0.14;
      const targetY =
        st.puckY < 0.42 && st.puckY > 0.12
          ? clamp(st.puckY - 0.06, 0.11, 0.36)
          : 0.15;
      const prevAx = st.partnerNx;
      const prevAy = st.partnerNy;
      st.partnerTargetNx = targetX;
      st.partnerTargetNy = targetY;
      const aiFactor = 1 - Math.exp(-8.5 * dt);
      st.partnerNx = lerp(st.partnerNx, st.partnerTargetNx, aiFactor);
      st.partnerNy = lerp(st.partnerNy, st.partnerTargetNy, aiFactor);
      st.partnerVx = (st.partnerNx - prevAx) / Math.max(dt, 0.008);
      st.partnerVy = (st.partnerNy - prevAy) / Math.max(dt, 0.008);
    } else {
      const prevPx = st.partnerNx;
      const prevPy = st.partnerNy;
      const netFactor = 1 - Math.exp(-18 * dt);
      st.partnerNx = lerp(st.partnerNx, st.partnerTargetNx, netFactor);
      st.partnerNy = lerp(st.partnerNy, st.partnerTargetNy, netFactor);
      st.partnerVx = (st.partnerNx - prevPx) / Math.max(dt, 0.008);
      st.partnerVy = (st.partnerNy - prevPy) / Math.max(dt, 0.008);
    }

    if (st.goalPauseTimer > 0) {
      st.goalPauseTimer = Math.max(0, st.goalPauseTimer - dt);
    } else {
      st.puckX += st.puckVx * dt;
      st.puckY += st.puckVy * dt;

      // Gentle air-table friction
      const drag = Math.pow(0.994, dt * 60);
      st.puckVx *= drag;
      st.puckVy *= drag;

      // Keep corner deflection clean so puck never traps
      const marginX = 0.055;
      if (st.puckX <= marginX) {
        st.puckX = marginX;
        st.puckVx = Math.abs(st.puckVx) * 0.94;
        arcadeSfx.wall();
        spawnSparks(st.particles, st.puckX, st.puckY, '#00F0FF', 5, 0.25);
      } else if (st.puckX >= 1 - marginX) {
        st.puckX = 1 - marginX;
        st.puckVx = -Math.abs(st.puckVx) * 0.94;
        arcadeSfx.wall();
        spawnSparks(st.particles, st.puckX, st.puckY, '#00F0FF', 5, 0.25);
      }

      // Goal checks (top = you score, bottom = partner scores)
      if (st.puckY <= 0.035) {
        if (st.puckX > goalLeft && st.puckX < goalRight) {
          st.scoreHer += 1;
          arcadeSfx.goal();
          triggerHaptic(35);
          st.shake = 0.015;
          spawnSparks(st.particles, st.puckX, 0.04, '#00F0FF', 22, 0.75);
          st.puckX = 0.5;
          st.puckY = 0.42;
          st.puckVx = (Math.random() - 0.5) * 0.22;
          st.puckVy = 0.45;
          st.goalPauseTimer = 0.65;
          st.puckTrail.length = 0;

          if (st.scoreHer >= 7) {
            st.phase = 'game_over';
            st.winnerText = 'YOU WIN!';
            arcadeSfx.win();
            onPhaseChange('game_over', { winnerText: 'YOU WIN!', score: `${st.scoreHer} - ${st.scoreHim}` });
          }
        } else {
          st.puckY = 0.042;
          st.puckVy = Math.abs(st.puckVy) * 0.94;
          arcadeSfx.wall();
        }
      } else if (st.puckY >= 0.965) {
        if (st.puckX > goalLeft && st.puckX < goalRight) {
          st.scoreHim += 1;
          arcadeSfx.crash();
          triggerHaptic(45);
          st.shake = 0.018;
          spawnSparks(st.particles, st.puckX, 0.96, '#FF003C', 22, 0.75);
          st.puckX = 0.5;
          st.puckY = 0.58;
          st.puckVx = (Math.random() - 0.5) * 0.22;
          st.puckVy = -0.45;
          st.goalPauseTimer = 0.65;
          st.puckTrail.length = 0;

          if (st.scoreHim >= 7) {
            st.phase = 'game_over';
            st.winnerText = isSolo ? 'AI WINS MATCH' : 'PARTNER WINS!';
            onPhaseChange('game_over', {
              winnerText: st.winnerText,
              score: `${st.scoreHer} - ${st.scoreHim}`,
            });
          }
        } else {
          st.puckY = 0.958;
          st.puckVy = -Math.abs(st.puckVy) * 0.94;
          arcadeSfx.wall();
        }
      }

      // Paddle strike resolution in true aspect space
      const resolveStrike = (px, py, pVx, pVy, color, isLocal) => {
        const dx = (st.puckX - px) * aspect;
        const dy = st.puckY - py;
        const dist = Math.hypot(dx, dy);
        const minDist = paddleR + puckR;
        if (dist < minDist && dist > 0.0001) {
          const nx = dx / dist;
          const ny = dy / dist;
          // Push puck cleanly out of overlap
          const overlap = minDist - dist + 0.004;
          st.puckX = clamp(st.puckX + (nx * overlap) / aspect, 0.055, 0.945);
          st.puckY = clamp(st.puckY + ny * overlap, 0.05, 0.95);

          const impactSpeed = clamp(0.62 + Math.hypot(pVx, pVy) * 0.52, 0.58, 1.38);
          st.puckVx = nx * impactSpeed + pVx * 0.28;
          st.puckVy = ny * impactSpeed + pVy * 0.28;

          const totalV = Math.hypot(st.puckVx, st.puckVy);
          if (totalV > 1.48) {
            st.puckVx = (st.puckVx / totalV) * 1.48;
            st.puckVy = (st.puckVy / totalV) * 1.48;
          }

          arcadeSfx.hit();
          if (isLocal) triggerHaptic(18);
          spawnSparks(st.particles, st.puckX, st.puckY, color, 8, 0.42);
        }
      };

      resolveStrike(st.myNx, st.myNy, st.myVx, st.myVy, '#00F0FF', true);
      resolveStrike(st.partnerNx, st.partnerNy, st.partnerVx, st.partnerVy, '#FF003C', false);

      st.puckTrail.push({ x: st.puckX, y: st.puckY });
      if (st.puckTrail.length > 12) st.puckTrail.shift();
    }
  }

  // Draw puck motion trail
  st.puckTrail.forEach((pt, idx) => {
    const ratio = (idx + 1) / st.puckTrail.length;
    ctx.globalAlpha = ratio * 0.28;
    ctx.fillStyle = '#00F0FF';
    ctx.beginPath();
    ctx.arc(pt.x * W, pt.y * H, Math.max(3, puckR * minDim * ratio), 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // Draw Partner Paddle
  const pRadPx = paddleR * minDim;
  ctx.fillStyle = '#FF003C';
  ctx.shadowColor = '#FF003C';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(st.partnerNx * W, st.partnerNy * H, pRadPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(st.partnerNx * W, st.partnerNy * H, pRadPx * 0.48, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Player Paddle
  ctx.fillStyle = '#00F0FF';
  ctx.shadowColor = '#00F0FF';
  ctx.beginPath();
  ctx.arc(st.myNx * W, st.myNy * H, pRadPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(st.myNx * W, st.myNy * H, pRadPx * 0.48, 0, Math.PI * 2);
  ctx.stroke();

  // Draw Puck
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(st.puckX * W, st.puckY * H, puckR * minDim, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  updateAndDrawParticles(ctx, st.particles, W, H, dt);

  return `YOU: ${st.scoreHer}  //  ${isSolo ? 'AI' : 'PARTNER'}: ${st.scoreHim}  •  FIRST TO 7`;
};

/**
 * GAME 2: SYNC OR SWIM (Co-Op Submarine Dive)
 */
export const stepAndDrawSubmarine = ({
  ctx,
  st,
  W,
  H,
  dt,
  timestamp,
  onPhaseChange,
}) => {
  const craftX = 0.25;
  const speedBoost = 1 + Math.min(st.gatesCleared * 0.035, 0.75);

  // Subtle parallax ocean depth lines
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const y = (H / 5) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Danger floor & ceiling strips
  ctx.fillStyle = 'rgba(255, 0, 60, 0.22)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillRect(0, H - 10, W, 10);

  if (st.phase === 'ready') {
    st.flappyY = 0.48 + Math.sin(timestamp * 0.004) * 0.025;
  } else if (st.phase === 'playing') {
    const GRAVITY = 1.65;
    st.flappyVy += GRAVITY * dt;
    st.flappyY += st.flappyVy * dt;

    // Emit periodic bubble trail
    st.bubbleCooldown -= dt;
    if (st.bubbleCooldown <= 0) {
      st.bubbleCooldown = 0.08;
      st.particles.push({
        x: craftX - 0.03,
        y: st.flappyY + (Math.random() - 0.5) * 0.02,
        vx: -0.22 - Math.random() * 0.12,
        vy: -0.14 - Math.random() * 0.12,
        life: 0.9,
        decay: 1.5,
        size: 2.5 + Math.random() * 2,
        color: '#67e8f9',
      });
    }

    // Move laser trenches & check collisions + scoring + bonus pearls
    for (let i = 0; i < st.pipes.length; i++) {
      const pipe = st.pipes[i];
      pipe.x -= 0.34 * speedBoost * dt;

      if (pipe.x < -0.12) {
        pipe.x = 1.18;
        pipe.gapY = 0.24 + Math.random() * 0.52;
        pipe.scored = false;
        pipe.pearlCollected = false;
        pipe.hasPearl = Math.random() > 0.35;
      }

      if (!pipe.scored && pipe.x < craftX - 0.04) {
        pipe.scored = true;
        st.gatesCleared += 1;
        arcadeSfx.wall();
      }

      // Check Bonus Pearl pickup
      if (pipe.hasPearl && !pipe.pearlCollected) {
        if (Math.hypot(pipe.x - craftX, pipe.gapY - st.flappyY) < 0.075) {
          pipe.pearlCollected = true;
          st.gatesCleared += 2;
          arcadeSfx.pearl();
          spawnSparks(st.particles, craftX, st.flappyY, '#FACC15', 14, 0.5);
        }
      }

      // Check real pipe collision (capsule/circle overlap)
      const hitX = Math.abs(pipe.x - craftX) < 0.056;
      const halfGap = Math.max(0.135, 0.175 - st.gatesCleared * 0.0012);
      const hitPipeWall = hitX && (st.flappyY < pipe.gapY - halfGap || st.flappyY > pipe.gapY + halfGap);
      const hitBoundary = st.flappyY <= 0.03 || st.flappyY >= 0.97;

      if (hitPipeWall || hitBoundary) {
        st.phase = 'game_over';
        st.shake = 0.025;
        arcadeSfx.crash();
        triggerHaptic(60);
        spawnSparks(st.particles, craftX, clamp(st.flappyY, 0.04, 0.96), '#FF003C', 28, 0.85);
        onPhaseChange('game_over', {
          winnerText: 'HULL BREACH',
          score: `${st.gatesCleared} PTS`,
          numericScore: st.gatesCleared,
        });
        break;
      }
    }
  }

  // Draw laser trench columns & bonus pearls
  const halfGapRender = Math.max(0.135, 0.175 - st.gatesCleared * 0.0012);
  st.pipes.forEach((pipe) => {
    const px = pipe.x * W;
    const gapTop = (pipe.gapY - halfGapRender) * H;
    const gapBottom = (pipe.gapY + halfGapRender) * H;

    ctx.fillStyle = '#1f0b14';
    ctx.strokeStyle = '#FF003C';
    ctx.lineWidth = 2.5;

    ctx.fillRect(px - 18, 0, 36, Math.max(0, gapTop));
    ctx.strokeRect(px - 18, -2, 36, Math.max(0, gapTop + 2));

    ctx.fillRect(px - 18, gapBottom, 36, Math.max(0, H - gapBottom));
    ctx.strokeRect(px - 18, gapBottom, 36, Math.max(0, H - gapBottom + 2));

    // Glowing bonus pearl inside trench
    if (pipe.hasPearl && !pipe.pearlCollected) {
      const py = pipe.gapY * H;
      ctx.fillStyle = '#FACC15';
      ctx.shadowColor = '#FACC15';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  });

  // Draw Animated Submarine Craft
  const sx = craftX * W;
  const sy = st.flappyY * H;
  const tilt = clamp(st.flappyVy * 0.65, -0.5, 0.55);

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(tilt);

  // Searchlight cone
  const coneGrad = ctx.createLinearGradient(14, 0, 95, 0);
  coneGrad.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
  coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(14, -4);
  ctx.lineTo(95, -24);
  ctx.lineTo(95, 24);
  ctx.lineTo(14, 4);
  ctx.closePath();
  ctx.fill();

  // Spinning rear propeller fin
  const propH = 5 + Math.abs(Math.sin(timestamp * 0.035)) * 7;
  ctx.strokeStyle = '#FF003C';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-21, -propH);
  ctx.lineTo(-21, propH);
  ctx.stroke();

  // Hull + Conning Tower + Viewport
  ctx.fillStyle = '#00F0FF';
  ctx.shadowColor = '#00F0FF';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-5, -17, 10, 7);
  ctx.shadowBlur = 0;

  ctx.fillStyle = '#070709';
  ctx.beginPath();
  ctx.arc(7, -1, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();

  updateAndDrawParticles(ctx, st.particles, W, H, dt);

  return `SCORE: ${st.gatesCleared}  //  BEST: ${st.bestSwimScore}`;
};

/**
 * GAME 3: SUMO BUMPER RING (Best of 5 Rounds)
 */
export const stepAndDrawSumo = ({
  ctx,
  st,
  W,
  H,
  dt,
  timestamp,
  isSolo,
  onPhaseChange,
}) => {
  const aspect = W / Math.max(H, 1);
  const minDim = Math.min(W, H);
  const bumperR = 0.068;

  // Gradually shrink arena radius for intense sudden-death duels
  st.sumoRingShrink = Math.min(0.12, st.sumoRingShrink + dt * 0.006);
  const normRingRadius = 0.42 - st.sumoRingShrink;
  const pxRingRadius = normRingRadius * minDim;
  const cx = W / 2;
  const cy = H / 2;

  // Outer danger glow & inner Dohyo circle
  ctx.fillStyle = 'rgba(255, 0, 60, 0.08)';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#0d0f15';
  ctx.beginPath();
  ctx.arc(cx, cy, pxRingRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#FF003C';
  ctx.lineWidth = 5;
  ctx.shadowColor = '#FF003C';
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, pxRingRadius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, pxRingRadius * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  if (st.phase === 'playing') {
    st.sumoDashCooldown = Math.max(0, st.sumoDashCooldown - dt);

    // Local player damped momentum toward pointer
    const pullX = (st.myNx - st.sumoMyX) * 16;
    const pullY = (st.myNy - st.sumoMyY) * 16;
    st.sumoMyVx = (st.sumoMyVx + pullX * dt) * Math.pow(0.88, dt * 60);
    st.sumoMyVy = (st.sumoMyVy + pullY * dt) * Math.pow(0.88, dt * 60);
    st.sumoMyX += st.sumoMyVx * dt;
    st.sumoMyY += st.sumoMyVy * dt;

    // Partner or Agile AI steering
    if (isSolo) {
      const distCenter = Math.hypot((st.sumoPartnerX - 0.5) * aspect, st.sumoPartnerY - 0.5);
      let goalX = st.sumoMyX;
      let goalY = st.sumoMyY;
      // Retreat inward if dangerously close to ring edge
      if (distCenter > normRingRadius * 0.72) {
        goalX = 0.5;
        goalY = 0.5;
      } else {
        goalX = st.sumoMyX + Math.sin(timestamp * 0.003) * 0.06;
        goalY = st.sumoMyY + Math.cos(timestamp * 0.0025) * 0.06;
      }
      const aiPullX = (goalX - st.sumoPartnerX) * 11;
      const aiPullY = (goalY - st.sumoPartnerY) * 11;
      st.sumoPartnerVx = (st.sumoPartnerVx + aiPullX * dt) * Math.pow(0.9, dt * 60);
      st.sumoPartnerVy = (st.sumoPartnerVy + aiPullY * dt) * Math.pow(0.9, dt * 60);
      st.sumoPartnerX += st.sumoPartnerVx * dt;
      st.sumoPartnerY += st.sumoPartnerVy * dt;
    } else {
      const targetVx = (st.partnerTargetNx - st.sumoPartnerX) * 14;
      const targetVy = (st.partnerTargetNy - st.sumoPartnerY) * 14;
      st.sumoPartnerVx = lerp(st.sumoPartnerVx, targetVx, 0.25);
      st.sumoPartnerVy = lerp(st.sumoPartnerVy, targetVy, 0.25);
      st.sumoPartnerX += st.sumoPartnerVx * dt;
      st.sumoPartnerY += st.sumoPartnerVy * dt;
    }

    // Body-to-body elastic knockback collision
    const dx = (st.sumoMyX - st.sumoPartnerX) * aspect;
    const dy = st.sumoMyY - st.sumoPartnerY;
    const dist = Math.hypot(dx, dy);
    const minDist = bumperR * 2;
    if (dist < minDist && dist > 0.0001) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      st.sumoMyX += (nx * overlap * 0.52) / aspect;
      st.sumoMyY += ny * overlap * 0.52;
      st.sumoPartnerX -= (nx * overlap * 0.52) / aspect;
      st.sumoPartnerY -= ny * overlap * 0.52;

      const relSpeed = Math.hypot(st.sumoMyVx - st.sumoPartnerVx, st.sumoMyVy - st.sumoPartnerVy);
      const knock = clamp(0.65 + relSpeed * 0.85, 0.65, 2.2);
      st.sumoMyVx += (nx * knock) / aspect;
      st.sumoMyVy += ny * knock;
      st.sumoPartnerVx -= (nx * knock) / aspect;
      st.sumoPartnerVy -= ny * knock;

      st.shake = 0.014;
      arcadeSfx.hit();
      triggerHaptic(32);
      spawnSparks(
        st.particles,
        (st.sumoMyX + st.sumoPartnerX) * 0.5,
        (st.sumoMyY + st.sumoPartnerY) * 0.5,
        '#FACC15',
        12,
        0.55
      );
    }

    // Ring-out KO check using true pixel distance from ring center
    const myDistPx = Math.hypot(st.sumoMyX * W - cx, st.sumoMyY * H - cy);
    const partnerDistPx = Math.hypot(st.sumoPartnerX * W - cx, st.sumoPartnerY * H - cy);

    if (partnerDistPx > pxRingRadius) {
      st.scoreHer += 1;
      arcadeSfx.goal();
      triggerHaptic(50);
      st.shake = 0.022;
      spawnSparks(st.particles, st.sumoPartnerX, st.sumoPartnerY, '#FF003C', 24, 0.75);
      const matchWon = st.scoreHer >= 3;
      st.phase = matchWon ? 'game_over' : 'round_over';
      st.winnerText = matchWon ? 'SUMO CHAMPION!' : 'RING OUT! +1 YOU';
      if (matchWon) arcadeSfx.win();
      onPhaseChange(st.phase, {
        winnerText: st.winnerText,
        score: `ROUNDS ${st.scoreHer} - ${st.scoreHim}`,
      });
    } else if (myDistPx > pxRingRadius) {
      st.scoreHim += 1;
      arcadeSfx.crash();
      triggerHaptic(60);
      st.shake = 0.022;
      spawnSparks(st.particles, st.sumoMyX, st.sumoMyY, '#00F0FF', 24, 0.75);
      const matchLost = st.scoreHim >= 3;
      st.phase = matchLost ? 'game_over' : 'round_over';
      st.winnerText = matchLost
        ? isSolo
          ? 'AI TAKES CROWN'
          : 'PARTNER WINS!'
        : 'RINGED OUT!';
      onPhaseChange(st.phase, {
        winnerText: st.winnerText,
        score: `ROUNDS ${st.scoreHer} - ${st.scoreHim}`,
      });
    }
  }

  const bRadPx = bumperR * minDim;

  // Draw Partner Bumper
  ctx.fillStyle = '#FF003C';
  ctx.shadowColor = '#FF003C';
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.arc(st.sumoPartnerX * W, st.sumoPartnerY * H, bRadPx, 0, Math.PI * 2);
  ctx.fill();

  // Draw Player Bumper + Dash Stamina Arc
  ctx.fillStyle = '#00F0FF';
  ctx.shadowColor = '#00F0FF';
  ctx.beginPath();
  ctx.arc(st.sumoMyX * W, st.sumoMyY * H, bRadPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  const staminaRatio = clamp(1 - st.sumoDashCooldown / 1.1, 0, 1);
  ctx.strokeStyle = staminaRatio >= 0.99 ? '#FACC15' : 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(
    st.sumoMyX * W,
    st.sumoMyY * H,
    bRadPx + 5,
    -Math.PI / 2,
    -Math.PI / 2 + Math.PI * 2 * staminaRatio
  );
  ctx.stroke();

  updateAndDrawParticles(ctx, st.particles, W, H, dt);

  return `ROUNDS: YOU ${st.scoreHer} - ${st.scoreHim} ${isSolo ? 'AI' : 'PARTNER'}  •  BEST OF 5`;
};

