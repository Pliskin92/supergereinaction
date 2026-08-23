// Procedural vector-style sprite drawing for Super Gere and cast.
// Everything is drawn with canvas primitives so no image assets are required.

const Palette = {
  skin: '#f2c49b',
  skinShade: '#d9a578',
  suitBlack: '#1b1b22',
  suitGold: '#e8b13d',
  capeGold: '#f0c34d',
  hair: '#6b4226',
  outline: '#0a0a0a',
};

function withAlpha(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// Draws a rounded rect helper
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Generic humanoid draw used for player + family cast, parameterized by palette/pose.
// pose: { walkPhase, action, facing, hitFlash }
function drawHumanoid(ctx, x, y, pose, colors) {
  const facing = pose.facing || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);

  const bob = pose.action === 'walk' ? Math.sin(pose.walkPhase) * 2 : 0;
  const legSwing = pose.action === 'walk' ? Math.sin(pose.walkPhase) * 8 : 0;
  const armSwing = pose.action === 'walk' ? Math.sin(pose.walkPhase) * 10 : 0;

  let armL = { x: -6, y: -20 + bob };
  let armR = { x: 6, y: -20 + bob };
  let legAngleL = legSwing;
  let legAngleR = -legSwing;
  let torsoLean = 0;
  let torsoY = bob;

  if (pose.action === 'punch1' || pose.action === 'punch2' || pose.action === 'punch3') {
    armR = { x: 16, y: -22 };
    torsoLean = 6;
  } else if (pose.action === 'slide') {
    torsoY = 10;
    legAngleL = 30;
    legAngleR = -10;
    torsoLean = -8;
  } else if (pose.action === 'hurt') {
    torsoLean = -10;
    torsoY = -2;
  } else if (pose.action === 'ko') {
    torsoLean = 90;
    torsoY = 18;
  }

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 2, 14, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(0, torsoY);
  ctx.rotate((torsoLean * Math.PI) / 180);

  // cape (if present)
  if (colors.cape) {
    ctx.fillStyle = colors.cape;
    ctx.strokeStyle = Palette.outline;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const capeSway = Math.sin((pose.walkPhase || pose.time || 0) * 0.5) * 4;
    ctx.moveTo(-6, -30);
    ctx.quadraticCurveTo(-16 + capeSway, -18, -14 + capeSway, 2);
    ctx.quadraticCurveTo(-10, -6, -4, -26);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // back arm
  drawLimb(ctx, armL.x * -1 + armSwing * 0.2, armL.y, 5, 14, colors.suit, -legSwing * 0.5);

  // legs
  drawLimb(ctx, -4, -6, 6, 16, colors.suit, legAngleL, true);
  drawLimb(ctx, 4, -6, 6, 16, colors.suit, legAngleR, true);

  // torso
  ctx.fillStyle = colors.suit;
  ctx.strokeStyle = Palette.outline;
  ctx.lineWidth = 1.2;
  rr(ctx, -9, -32, 18, 22, 4);
  ctx.fill();
  ctx.stroke();

  // belt
  ctx.fillStyle = colors.accent;
  ctx.fillRect(-9, -12, 18, 3);

  // chest emblem
  if (colors.emblem) {
    ctx.fillStyle = colors.accent;
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(colors.emblem, 0, -20);
  }

  // front arm
  const frontArmY = pose.action && pose.action.startsWith('punch') ? armR.y : armR.y + bob;
  if (pose.action === 'punch1' || pose.action === 'punch2' || pose.action === 'punch3') {
    ctx.fillStyle = colors.suit;
    drawFist(ctx, armR.x, frontArmY, colors.skin || Palette.skin);
  } else {
    drawLimb(ctx, armR.x - armSwing * 0.2, -20 + bob, 5, 14, colors.suit, legSwing * 0.5);
  }

  // head
  const headY = -38;
  ctx.fillStyle = colors.skin || Palette.skin;
  ctx.strokeStyle = Palette.outline;
  ctx.beginPath();
  ctx.arc(0, headY, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // hair
  ctx.fillStyle = colors.hair || Palette.hair;
  ctx.beginPath();
  ctx.arc(0, headY - 2, 8.5, Math.PI, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = Palette.outline;
  if (pose.action === 'ko') {
    ctx.beginPath();
    ctx.moveTo(-3, headY - 1); ctx.lineTo(-1, headY + 1);
    ctx.moveTo(-1, headY - 1); ctx.lineTo(-3, headY + 1);
    ctx.moveTo(1, headY - 1); ctx.lineTo(3, headY + 1);
    ctx.moveTo(3, headY - 1); ctx.lineTo(1, headY + 1);
    ctx.strokeStyle = Palette.outline;
    ctx.stroke();
  } else {
    ctx.fillStyle = Palette.outline;
    ctx.fillRect(1.5, headY - 1, 2, 2);
    ctx.fillRect(-3.5, headY - 1, 2, 2);
  }

  ctx.restore(); // torso rotate/translate

  ctx.restore(); // facing scale
}

function drawLimb(ctx, x, y, w, h, color, angleDeg, isLeg) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.strokeStyle = Palette.outline;
  ctx.lineWidth = 1;
  rr(ctx, -w / 2, 0, w, h, 2);
  ctx.fill();
  ctx.stroke();
  if (isLeg) {
    ctx.fillStyle = Palette.suitBlack;
    ctx.fillRect(-w / 2 - 1, h - 2, w + 2, 4);
  }
  ctx.restore();
}

function drawFist(ctx, x, y, skin) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = skin;
  ctx.strokeStyle = Palette.outline;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// Draws an impact star burst for hit effects
function drawImpact(ctx, x, y, t, color) {
  const r = 6 + t * 14;
  const alpha = Math.max(0, 1 - t);
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color || '#fff';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.stroke();
  }
  ctx.restore();
}
