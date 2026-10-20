export interface Chapter {
  id: number;
  name: string;
  tagline: string;
  from: number;
  to: number;
  accent: string;
}

export const chapters: Chapter[] = [
  { id: 1, name: "Boot Sequence", tagline: "Learn the line", from: 1, to: 25, accent: "#00f3ff" },
  { id: 2, name: "Neon District", tagline: "Find your flow", from: 26, to: 50, accent: "#8a2be2" },
  { id: 3, name: "Data Stream", tagline: "Read the grid", from: 51, to: 75, accent: "#ff6ec7" },
  { id: 4, name: "Ghost Protocol", tagline: "No room for guesses", from: 76, to: 100, accent: "#00ffff" },
  { id: 5, name: "Overclock", tagline: "Elite tier begins", from: 101, to: 125, accent: "#ffd700" },
  { id: 6, name: "Deep Net", tagline: "Trust your instincts", from: 126, to: 150, accent: "#00ff41" },
  { id: 7, name: "Black Ice", tagline: "One line, no mercy", from: 151, to: 175, accent: "#ff6b35" },
  { id: 8, name: "Singularity", tagline: "The final circuit", from: 176, to: 200, accent: "#c77dff" },
];

export function getChapterForLevel(levelId: number): Chapter {
  return chapters.find(chapter => levelId >= chapter.from && levelId <= chapter.to) ?? chapters[0];
}
