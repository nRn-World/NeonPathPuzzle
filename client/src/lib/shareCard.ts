import { formatDuration } from "./scoring";

interface ShareInput {
  levelId: number;
  timeMs: number;
  stars: number;
  /** Only present for the daily challenge. */
  dateKey?: string;
  streak?: number;
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function createCard(input: ShareInput): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");

  const gradient = context.createLinearGradient(0, 0, 1080, 1920);
  gradient.addColorStop(0, "#050914");
  gradient.addColorStop(0.55, "#0a0f1e");
  gradient.addColorStop(1, "#140a2e");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1080, 1920);

  // Faint grid, echoing the puzzle board.
  context.strokeStyle = "rgba(0, 243, 255, 0.07)";
  context.lineWidth = 2;
  for (let offset = 0; offset <= 1080; offset += 90) {
    context.beginPath();
    context.moveTo(offset, 0);
    context.lineTo(offset, 1920);
    context.stroke();
  }
  for (let offset = 0; offset <= 1920; offset += 90) {
    context.beginPath();
    context.moveTo(0, offset);
    context.lineTo(1080, offset);
    context.stroke();
  }

  const glow = context.createRadialGradient(540, 760, 40, 540, 760, 620);
  glow.addColorStop(0, "rgba(0, 243, 255, 0.20)");
  glow.addColorStop(1, "rgba(0, 243, 255, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, 1080, 1920);

  const isDaily = Boolean(input.dateKey);

  context.textAlign = "center";
  context.fillStyle = "#00f3ff";
  context.font = "700 30px 'Exo 2', Arial, sans-serif";
  context.fillText("NEON PATH PUZZLE", 540, 190);

  context.fillStyle = "#ffffff";
  context.font = "700 96px Orbitron, Arial, sans-serif";
  context.fillText(isDaily ? "DAILY" : "LEVEL", 540, 330);
  context.fillText(isDaily ? "CLEARED" : String(input.levelId), 540, 430);

  context.fillStyle = "rgba(255,255,255,0.55)";
  context.font = "400 32px 'Exo 2', Arial, sans-serif";
  context.fillText(isDaily ? input.dateKey ?? "" : "CLEARED", 540, 500);

  // Result panel.
  roundRect(context, 110, 590, 860, 520, 36);
  context.fillStyle = "rgba(10, 15, 30, 0.72)";
  context.fill();
  context.strokeStyle = "rgba(0, 243, 255, 0.35)";
  context.lineWidth = 3;
  context.stroke();

  context.fillStyle = "rgba(255,255,255,0.5)";
  context.font = "500 28px 'Exo 2', Arial, sans-serif";
  context.fillText(isDaily ? "LEVEL " + input.levelId : "CLEARED IN", 540, 675);

  context.fillStyle = "#ffffff";
  context.font = "700 170px Orbitron, Arial, sans-serif";
  context.fillText(formatDuration(input.timeMs), 540, 850);

  context.fillStyle = "rgba(255,255,255,0.55)";
  context.font = "400 28px 'Exo 2', Arial, sans-serif";
  context.fillText("TIME", 540, 900);

  // Stars.
  const starCount = Math.max(1, Math.min(3, input.stars));
  const starSpacing = 110;
  const starStart = 540 - starSpacing;
  for (let index = 0; index < 3; index++) {
    context.font = "700 78px Arial, sans-serif";
    context.fillStyle = index < starCount ? "#ffd700" : "rgba(255,255,255,0.14)";
    context.fillText("★", starStart + index * starSpacing, 1010);
  }

  if ((input.streak ?? 0) > 0) {
    roundRect(context, 280, 1170, 520, 104, 52);
    context.fillStyle = "rgba(255, 107, 53, 0.14)";
    context.fill();
    context.strokeStyle = "rgba(255, 107, 53, 0.45)";
    context.lineWidth = 2;
    context.stroke();
    context.fillStyle = "#ff9f6b";
    context.font = "700 40px 'Exo 2', Arial, sans-serif";
    context.fillText(`${input.streak ?? 0} DAY STREAK`, 540, 1236);
  }

  context.fillStyle = "rgba(255,255,255,0.7)";
  context.font = "400 30px 'Exo 2', Arial, sans-serif";
  context.fillText("One line. Every node. Every day.", 540, 1370);

  context.fillStyle = "rgba(0, 243, 255, 0.75)";
  context.font = "500 26px 'Exo 2', Arial, sans-serif";
  context.fillText("nrnworld.one/NeonPathPuzzle", 540, 1770);

  return canvas;
}

async function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("Could not create image"));
    }, "image/png");
  });
}

export type ShareOutcome = "shared" | "downloaded" | "copied" | "failed";

export async function shareResult(input: ShareInput): Promise<ShareOutcome> {
  const isDaily = Boolean(input.dateKey);
  const streak = input.streak ?? 0;
  const text = isDaily
    ? `Neon Path Daily ${input.dateKey}: ${formatDuration(input.timeMs)}, ${input.stars}/3 stars${streak > 0 ? `, ${streak} day streak` : ""}.`
    : `Neon Path level ${input.levelId}: ${formatDuration(input.timeMs)}, ${input.stars}/3 stars.`;
  const fileName = isDaily
    ? `neon-path-daily-${input.dateKey}.png`
    : `neon-path-level-${input.levelId}.png`;

  try {
    const canvas = createCard(input);
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], fileName, { type: "image/png" });
    const shareData: ShareData = {
      files: [file],
      title: "Neon Path Puzzle",
      text,
    };

    if (typeof navigator !== "undefined" && navigator.canShare?.(shareData) && navigator.share) {
      await navigator.share(shareData);
      return "shared";
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
    return "downloaded";
  } catch {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
