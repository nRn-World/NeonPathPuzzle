import type { Point } from "@shared/schema";

/**
 * The board that draws itself on the title screen. It is a frozen snapshot, not
 * a live campaign level, so retuning the campaign never changes the first thing
 * a player sees. Solution order is the order the line is drawn in.
 */
export const HERO_BOARD = {
  gridSize: 10,
  solution: ([[2,1],[1,1],[1,2],[2,2],[2,3],[3,3],[3,4],[3,5],[4,5],[5,5],[5,6],[5,7],[4,7],[4,8],[3,8],[3,9],[2,9],[2,8],[2,7],[2,6],[1,6],[1,7],[0,7],[0,6],[0,5],[0,4],[1,4],[1,3],[0,3],[0,2],[0,1],[0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[3,1],[3,2],[4,2],[4,3],[5,3],[5,4],[6,4],[6,3],[6,2],[6,1],[7,1],[7,2],[7,3],[7,4],[7,5],[8,5],[8,6],[8,7],[7,7],[7,8],[6,8],[5,8],[5,9]] as [number, number][]).map(([x, y]): Point => ({ x, y })),
};

/**
 * A smaller board for the first-run tutorial. The title art is a dense 10x10
 * circuit, which turns into an unreadable scribble at 160 px; this one is short
 * enough that a new player can follow the line from start to finish.
 */
export const TUTORIAL_BOARD = {
  gridSize: 5,
  solution: ([[0,4],[1,4],[2,4],[2,3],[2,2],[1,2],[0,2],[0,1],[1,1],[2,1],[3,1],[3,2],[3,3],[4,3],[4,4]] as [number, number][]).map(([x, y]): Point => ({ x, y })),
};
