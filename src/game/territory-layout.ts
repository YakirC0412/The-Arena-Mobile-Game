import type { ArenaCell } from '@/game/types';

export type TerritoryLabelRegion = {
  anchorId: number;
  height: number;
  left: number;
  top: number;
  width: number;
};

export function getTerritoryLabelRegion(cells: ArenaCell[]): TerritoryLabelRegion {
  const occupied = new Set(cells.map((cell) => `${cell.row}:${cell.column}`));
  let best = { area: 0, columns: 1, rows: 1, startColumn: cells[0].column, startRow: cells[0].row };

  for (let startRow = 0; startRow < 4; startRow += 1) {
    for (let endRow = startRow; endRow < 4; endRow += 1) {
      for (let startColumn = 0; startColumn < 4; startColumn += 1) {
        for (let endColumn = startColumn; endColumn < 4; endColumn += 1) {
          let complete = true;
          for (let row = startRow; row <= endRow && complete; row += 1) {
            for (let column = startColumn; column <= endColumn; column += 1) {
              if (!occupied.has(`${row}:${column}`)) {
                complete = false;
                break;
              }
            }
          }
          if (!complete) continue;
          const rows = endRow - startRow + 1;
          const columns = endColumn - startColumn + 1;
          const area = rows * columns;
          const bestBalance = Math.min(best.rows, best.columns) / Math.max(best.rows, best.columns);
          const balance = Math.min(rows, columns) / Math.max(rows, columns);
          if (area > best.area || (area === best.area && balance > bestBalance)) {
            best = { area, columns, rows, startColumn, startRow };
          }
        }
      }
    }
  }

  const centerRow = best.startRow + (best.rows - 1) / 2;
  const centerColumn = best.startColumn + (best.columns - 1) / 2;
  const anchor = cells.reduce((closest, cell) => {
    const distance = (cell.row - centerRow) ** 2 + (cell.column - centerColumn) ** 2;
    const closestDistance = (closest.row - centerRow) ** 2 + (closest.column - centerColumn) ** 2;
    return distance < closestDistance ? cell : closest;
  });

  return {
    anchorId: anchor.id,
    height: best.rows * 25,
    left: best.startColumn * 25,
    top: best.startRow * 25,
    width: best.columns * 25,
  };
}
