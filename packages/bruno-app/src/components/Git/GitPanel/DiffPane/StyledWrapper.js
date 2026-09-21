import styled from 'styled-components';
import { rgba } from 'polished';

const StyledWrapper = styled.div`
  border: 1px solid ${(props) => props.theme.border.border1};
  border-radius: ${(props) => props.theme.border.radius.sm};
  background: ${(props) => props.theme.bg};

  .diff-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-bottom: 1px solid ${(props) => props.theme.border.border1};

    .diff-file-path {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
      font-size: ${(props) => props.theme.font.size.sm};
    }

    .diff-kind {
      flex-shrink: 0;
      font-size: ${(props) => props.theme.font.size.xs};
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .diff-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
  }

  .diff-empty {
    padding: 2rem;
    text-align: center;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .diff-raw-text {
    margin: 0;
    padding: 8px;
    font-family: 'Fira Code', monospace;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
    overflow: auto;
  }

  /* Row styling mirrors the spec diff in OpenAPISyncTab so both diff views read identically. */
  .diff-rows {
    height: 100%;

    .diff-row {
      display: grid;
      grid-template-columns: 9ch 1fr 9ch 1fr;
      font-family: 'Fira Code', monospace;
      font-size: 12px;
      line-height: 1.5;
      /* Must match Virtuoso's fixedItemHeight in RawDiffView. */
      min-height: 18px;
      color: ${(props) => props.theme.text};
      font-variant-ligatures: none;
      font-feature-settings: 'liga' 0, 'calt' 0;
    }

    /* Vertical divider between the two side-by-side panels. */
    .diff-row > *:nth-child(3) {
      border-left: 1px solid ${(props) => props.theme.border.border1};
    }

    .diff-cell-num {
      padding: 0 0.5em;
      text-align: right;
      color: ${(props) => props.theme.colors.text.muted};
      user-select: none;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .diff-cell-code {
      display: flex;
      min-width: 0;
      padding: 0 0.5em;
      white-space: pre;
      overflow: hidden;
    }

    .diff-cell-num,
    .diff-cell-code {
      &.diff-kind-del {
        background-color: color-mix(in srgb, ${(props) => props.theme.colors.text.danger} 22%, transparent);
      }

      &.diff-kind-ins {
        background-color: color-mix(in srgb, ${(props) => props.theme.colors.text.green} 15%, transparent);
      }

      &.diff-kind-empty {
        background-color: ${(props) => rgba(props.theme.colors.text.muted, 0.05)};
      }
    }

    .diff-prefix {
      width: 1em;
      flex-shrink: 0;
      color: ${(props) => props.theme.colors.text.muted};
      user-select: none;
    }

    .diff-content {
      flex: 1 1 auto;
      min-width: 0;
      overflow-x: auto;
      scrollbar-width: thin;

      del {
        background-color: color-mix(in srgb, ${(props) => props.theme.colors.text.danger} 40%, transparent);
        text-decoration: none;
      }

      ins {
        background-color: color-mix(in srgb, ${(props) => props.theme.colors.text.green} 40%, transparent);
        text-decoration: none;
      }
    }

    /* Borders would break Virtuoso's fixed 18px row height, so the rule is an inset shadow. */
    .diff-row-hunk {
      grid-template-columns: 1fr;
      background-color: ${(props) => rgba(props.theme.colors.text.muted, 0.08)};
      color: ${(props) => props.theme.colors.text.muted};
      box-shadow:
        inset 0 1px 0 ${(props) => props.theme.border.border1},
        inset 0 -1px 0 ${(props) => props.theme.border.border1};

      .diff-cell-hunk {
        padding: 0 0.75em;
        font-family: 'Fira Code', monospace;
        font-size: 11px;
        white-space: pre;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
  }
`;

export default StyledWrapper;
