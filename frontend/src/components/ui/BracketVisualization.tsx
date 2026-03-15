import { useTranslation } from 'react-i18next';
import type { BracketRound, BracketMatch } from '../../types';
import './BracketVisualization.css';

interface BracketVisualizationProps {
  rounds: BracketRound[];
  getWrestlerName: (id: string) => string;
}

// Layout constants
const MATCH_WIDTH = 220;
const MATCH_HEIGHT = 60;
const PARTICIPANT_ROW_HEIGHT = 26;
const PARTICIPANT_PADDING = 4;
const ROUND_GAP = 60;
const COLUMN_WIDTH = MATCH_WIDTH + ROUND_GAP;
const LABEL_HEIGHT = 30;
const TOP_PADDING = 10;
const SIDE_PADDING = 20;
const BASE_VERTICAL_GAP = 24;

interface Position {
  x: number;
  y: number;
}

function getMatchPositions(rounds: BracketRound[]): Position[][] {
  const positions: Position[][] = [];

  for (let roundIdx = 0; roundIdx < rounds.length; roundIdx++) {
    const round = rounds[roundIdx];
    if (!round) continue;

    const x = SIDE_PADDING + roundIdx * COLUMN_WIDTH;
    const roundPositions: Position[] = [];

    if (roundIdx === 0) {
      for (let matchIdx = 0; matchIdx < round.matches.length; matchIdx++) {
        const y = LABEL_HEIGHT + TOP_PADDING + matchIdx * (MATCH_HEIGHT + BASE_VERTICAL_GAP);
        roundPositions.push({ x, y });
      }
    } else {
      const prevPositions = positions[roundIdx - 1];
      if (!prevPositions) continue;

      for (let matchIdx = 0; matchIdx < round.matches.length; matchIdx++) {
        const sourceIdx1 = matchIdx * 2;
        const sourceIdx2 = matchIdx * 2 + 1;
        const src1 = prevPositions[sourceIdx1];
        const src2 = prevPositions[sourceIdx2];

        if (src1 && src2) {
          roundPositions.push({ x, y: (src1.y + src2.y) / 2 });
        } else if (src1) {
          roundPositions.push({ x, y: src1.y });
        } else {
          const y = LABEL_HEIGHT + TOP_PADDING + matchIdx * (MATCH_HEIGHT + BASE_VERTICAL_GAP);
          roundPositions.push({ x, y });
        }
      }
    }

    positions.push(roundPositions);
  }

  return positions;
}

interface ConnectorData {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isWinnerPath: boolean;
  animationDelay: number;
}

function Connector({ fromX, fromY, toX, toY, isWinnerPath, animationDelay }: ConnectorData) {
  const midX = fromX + (toX - fromX) / 2;
  const d = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

  return (
    <path
      className={`bracket-viz-connector${isWinnerPath ? ' bracket-viz-connector--winner' : ''}`}
      d={d}
      style={{ animationDelay: `${animationDelay}ms` }}
    />
  );
}

interface MatchBoxProps {
  match: BracketMatch;
  x: number;
  y: number;
  getWrestlerName: (id: string) => string;
  tbdLabel: string;
}

function MatchBox({ match, x, y, getWrestlerName, tbdLabel }: MatchBoxProps) {
  const p1Name = match.participant1 ? getWrestlerName(match.participant1) : tbdLabel;
  const p2Name = match.participant2 ? getWrestlerName(match.participant2) : tbdLabel;
  const p1IsWinner = !!(match.winner && match.participant1 && match.winner === match.participant1);
  const p2IsWinner = !!(match.winner && match.participant2 && match.winner === match.participant2);
  const p1IsTbd = !match.participant1;
  const p2IsTbd = !match.participant2;

  const innerPadding = 4;
  const rowWidth = MATCH_WIDTH - innerPadding * 2;
  const rowY1 = y + PARTICIPANT_PADDING;
  const rowY2 = y + PARTICIPANT_PADDING + PARTICIPANT_ROW_HEIGHT + 2;
  const accentWidth = 3;

  return (
    <g>
      <rect
        className="bracket-viz-match-box"
        x={x}
        y={y}
        width={MATCH_WIDTH}
        height={MATCH_HEIGHT}
      />

      {/* Participant 1 */}
      <rect
        className={`bracket-viz-participant-bg${p1IsWinner ? ' bracket-viz-participant-bg--winner' : ''}`}
        x={x + innerPadding}
        y={rowY1}
        width={rowWidth}
        height={PARTICIPANT_ROW_HEIGHT}
      />
      {p1IsWinner && (
        <rect
          className="bracket-viz-winner-accent"
          x={x + innerPadding}
          y={rowY1}
          width={accentWidth}
          height={PARTICIPANT_ROW_HEIGHT}
        />
      )}
      <text
        className={`bracket-viz-participant-name${p1IsTbd ? ' bracket-viz-participant-name--tbd' : ''}${p1IsWinner ? ' bracket-viz-participant-name--winner' : ''}`}
        x={x + innerPadding + 8}
        y={rowY1 + PARTICIPANT_ROW_HEIGHT / 2}
      >
        {p1Name}
      </text>
      {p1IsWinner && (
        <text
          className="bracket-viz-checkmark"
          x={x + MATCH_WIDTH - innerPadding - 6}
          y={rowY1 + PARTICIPANT_ROW_HEIGHT / 2}
        >
          &#x2713;
        </text>
      )}

      {/* Divider */}
      <line
        className="bracket-viz-divider"
        x1={x + innerPadding}
        y1={rowY1 + PARTICIPANT_ROW_HEIGHT + 1}
        x2={x + MATCH_WIDTH - innerPadding}
        y2={rowY1 + PARTICIPANT_ROW_HEIGHT + 1}
      />

      {/* Participant 2 */}
      <rect
        className={`bracket-viz-participant-bg${p2IsWinner ? ' bracket-viz-participant-bg--winner' : ''}`}
        x={x + innerPadding}
        y={rowY2}
        width={rowWidth}
        height={PARTICIPANT_ROW_HEIGHT}
      />
      {p2IsWinner && (
        <rect
          className="bracket-viz-winner-accent"
          x={x + innerPadding}
          y={rowY2}
          width={accentWidth}
          height={PARTICIPANT_ROW_HEIGHT}
        />
      )}
      <text
        className={`bracket-viz-participant-name${p2IsTbd ? ' bracket-viz-participant-name--tbd' : ''}${p2IsWinner ? ' bracket-viz-participant-name--winner' : ''}`}
        x={x + innerPadding + 8}
        y={rowY2 + PARTICIPANT_ROW_HEIGHT / 2}
      >
        {p2Name}
      </text>
      {p2IsWinner && (
        <text
          className="bracket-viz-checkmark"
          x={x + MATCH_WIDTH - innerPadding - 6}
          y={rowY2 + PARTICIPANT_ROW_HEIGHT / 2}
        >
          &#x2713;
        </text>
      )}
    </g>
  );
}

function buildConnectors(rounds: BracketRound[], positions: Position[][]): ConnectorData[] {
  const connectors: ConnectorData[] = [];

  for (let roundIdx = 1; roundIdx < rounds.length; roundIdx++) {
    const currentRound = rounds[roundIdx];
    const prevRound = rounds[roundIdx - 1];
    const prevPositions = positions[roundIdx - 1];
    const currentPositions = positions[roundIdx];
    if (!currentRound || !prevRound || !prevPositions || !currentPositions) continue;

    for (let matchIdx = 0; matchIdx < currentRound.matches.length; matchIdx++) {
      const targetPos = currentPositions[matchIdx];
      const targetMatch = currentRound.matches[matchIdx];
      if (!targetPos || !targetMatch) continue;

      const sourceIdx1 = matchIdx * 2;
      const sourceIdx2 = matchIdx * 2 + 1;

      // Connector from source match 1 (top feed)
      const src1Pos = prevPositions[sourceIdx1];
      const src1Match = prevRound.matches[sourceIdx1];
      if (src1Pos && src1Match) {
        const isWinnerPath = !!(src1Match.winner && (
          src1Match.winner === targetMatch.participant1 ||
          src1Match.winner === targetMatch.participant2
        ));
        connectors.push({
          fromX: src1Pos.x + MATCH_WIDTH,
          fromY: src1Pos.y + MATCH_HEIGHT / 2,
          toX: targetPos.x,
          toY: targetPos.y + MATCH_HEIGHT / 4,
          isWinnerPath,
          animationDelay: (roundIdx - 1) * 300 + matchIdx * 100,
        });
      }

      // Connector from source match 2 (bottom feed)
      const src2Pos = prevPositions[sourceIdx2];
      const src2Match = prevRound.matches[sourceIdx2];
      if (src2Pos && src2Match) {
        const isWinnerPath = !!(src2Match.winner && (
          src2Match.winner === targetMatch.participant1 ||
          src2Match.winner === targetMatch.participant2
        ));
        connectors.push({
          fromX: src2Pos.x + MATCH_WIDTH,
          fromY: src2Pos.y + MATCH_HEIGHT / 2,
          toX: targetPos.x,
          toY: targetPos.y + (MATCH_HEIGHT * 3) / 4,
          isWinnerPath,
          animationDelay: (roundIdx - 1) * 300 + matchIdx * 100 + 50,
        });
      }
    }
  }

  return connectors;
}

export default function BracketVisualization({ rounds, getWrestlerName }: BracketVisualizationProps) {
  const { t } = useTranslation();
  const tbdLabel = t('common.tbd');

  if (rounds.length === 0) return null;

  const positions = getMatchPositions(rounds);

  // Calculate SVG dimensions
  const svgWidth = SIDE_PADDING * 2 + rounds.length * COLUMN_WIDTH - ROUND_GAP;
  let svgHeight = LABEL_HEIGHT + TOP_PADDING + 40;
  for (const roundPositions of positions) {
    for (const pos of roundPositions) {
      const bottom = pos.y + MATCH_HEIGHT + 10;
      if (bottom > svgHeight) svgHeight = bottom;
    }
  }

  const connectors = buildConnectors(rounds, positions);

  return (
    <div className="bracket-viz-scroll">
      <svg
        className="bracket-viz"
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Round labels */}
        {rounds.map((round, roundIdx) => {
          const x = SIDE_PADDING + roundIdx * COLUMN_WIDTH + MATCH_WIDTH / 2;
          const isLastRound = rounds.length === roundIdx + 1 && rounds.length > 1;
          const roundLabel = isLastRound
            ? t('tournaments.final', { defaultValue: 'Final' })
            : `${t('tournaments.round')} ${round.roundNumber}`;
          return (
            <text
              key={`label-${round.roundNumber}`}
              className="bracket-viz-round-label"
              x={x}
              y={LABEL_HEIGHT - 8}
            >
              {roundLabel}
            </text>
          );
        })}

        {/* Connector lines (rendered behind match boxes) */}
        {connectors.map((connector, idx) => (
          <Connector key={`connector-${idx}`} {...connector} />
        ))}

        {/* Match boxes */}
        {rounds.map((round, roundIdx) => {
          const roundPositions = positions[roundIdx];
          if (!roundPositions) return null;
          return round.matches.map((match: BracketMatch, matchIdx: number) => {
            const pos = roundPositions[matchIdx];
            if (!pos) return null;
            return (
              <MatchBox
                key={`match-${roundIdx}-${matchIdx}`}
                match={match}
                x={pos.x}
                y={pos.y}
                getWrestlerName={getWrestlerName}
                tbdLabel={tbdLabel}
              />
            );
          });
        })}
      </svg>
    </div>
  );
}
