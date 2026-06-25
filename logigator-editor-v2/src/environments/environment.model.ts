export interface Environment {
  apiUrl: string;
  gridSize: number;
  debug: {
    showGridBorders: boolean;
    showHitboxes: boolean;
    showOrigins: boolean;
    showConnectionPoints: boolean;
    showQuadTrees: boolean;
    /** Shows the title-bar "Debug" menu (compiled-board/renderer dumps, Project
     * Dump export/import). Off in production. */
    menu: boolean;
  };
}
