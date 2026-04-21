import { useEffect, useRef } from "react";

const COLORS = [
  "rgba(184,217,141,",
  "rgba(100,180,255,",
  "rgba(255,160,120,",
  "rgba(200,140,255,",
  "rgba(80,220,180,",
];

function mkBubble(W, H) {
  const angle = Math.random() * Math.PI * 2;
  const speed = 0.3 + Math.random() * 0.6;
  return {
    x: Math.random() * W,
    y: Math.random() * H,
    r: 6 + Math.random() * 28,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: 0.08 + Math.random() * 0.18,
    attract: 0.012 + Math.random() * 0.018,
    life: 0,
    maxLife: 300 + Math.random() * 400,
  };
}

export default function BubbleBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W, H, raf;
    const mouse = { x: -999, y: -999 };
    let bubbles = [];

    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();

    bubbles = Array.from({ length: 45 }, () => mkBubble(W, H));

    const onMouseMove = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onMouseLeave = () => {
      mouse.x = -999;
      mouse.y = -999;
    };

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("resize", resize);

    const tick = () => {
      ctx.clearRect(0, 0, W, H);

      for (let i = 0; i < bubbles.length; i++) {
        const b = bubbles[i];
        b.life++;

        if (mouse.x > 0) {
          const dx = mouse.x - b.x;
          const dy = mouse.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = b.attract * (1 - Math.min(dist, 320) / 320);
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
        }

        const speed = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        if (speed > 2.5) {
          b.vx = (b.vx / speed) * 2.5;
          b.vy = (b.vy / speed) * 2.5;
        }

        b.x += b.vx;
        b.y += b.vy;
        b.vx *= 0.98;
        b.vy *= 0.98;

        if (b.x < -b.r) b.x = W + b.r;
        if (b.x > W + b.r) b.x = -b.r;
        if (b.y < -b.r) b.y = H + b.r;
        if (b.y > H + b.r) b.y = -b.r;

        const fade =
          b.life < 40
            ? b.life / 40
            : b.life > b.maxLife - 40
            ? (b.maxLife - b.life) / 40
            : 1;
        const a = b.alpha * fade;

        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = b.color + a + ")";
        ctx.fill();
        ctx.strokeStyle = b.color + a * 1.5 + ")";
        ctx.lineWidth = 0.8;
        ctx.stroke();

        if (b.life >= b.maxLife) {
          bubbles[i] = mkBubble(W, H);
        }
      }

      if (mouse.x > 0) {
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 5, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255,255,255,0.85)";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 20, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.18)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      raf = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
