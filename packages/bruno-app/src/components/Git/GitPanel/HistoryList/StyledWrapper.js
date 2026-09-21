import styled from 'styled-components';

const StyledWrapper = styled.div`
  .history-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 4px 5px 2px;
    font-size: ${(props) => props.theme.font.size.base};
    cursor: pointer;
    border-radius: ${(props) => props.theme.border.radius.sm};

    &:hover {
      background: ${(props) => props.theme.plainGrid.hoverBg};
    }

    .commit-hash {
      flex-shrink: 0;
      font-family: monospace;
      font-size: ${(props) => props.theme.font.size.sm};
      color: ${(props) => props.theme.colors.text.yellow};
    }

    .commit-message {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .commit-meta {
      flex-shrink: 0;
      font-size: ${(props) => props.theme.font.size.sm};
      color: ${(props) => props.theme.colors.text.muted};
    }
  }

  .commit-file-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 3px 4px 3px 26px;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
    cursor: pointer;
    border-radius: ${(props) => props.theme.border.radius.sm};

    &:hover {
      background: ${(props) => props.theme.plainGrid.hoverBg};
    }

    &.selected {
      background: ${(props) => props.theme.plainGrid.hoverBg};
      color: ${(props) => props.theme.colors.text.white};
    }

    .file-status {
      flex-shrink: 0;
      width: 1.25rem;
      text-align: center;
      font-weight: 700;
      color: ${(props) => props.theme.colors.text.muted};

      &.added {
        color: ${(props) => props.theme.colors.text.green};
      }

      &.deleted {
        color: ${(props) => props.theme.colors.text.danger};
      }

      &.modified {
        color: ${(props) => props.theme.colors.text.warning};
      }
    }

    .file-path {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .history-empty {
    padding: 6px 2px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
