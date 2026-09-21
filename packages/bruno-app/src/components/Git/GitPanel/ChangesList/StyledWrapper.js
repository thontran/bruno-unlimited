import styled from 'styled-components';

const StyledWrapper = styled.div`
  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    color: ${(props) => props.theme.colors.text.muted};
    border-bottom: 1px solid ${(props) => props.theme.table.border};
  }

  .group-count {
    font-weight: 400;
  }

  .change-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 2px;
    font-size: ${(props) => props.theme.font.size.base};
    cursor: pointer;
    border-radius: ${(props) => props.theme.border.radius.sm};

    &:hover {
      background: ${(props) => props.theme.plainGrid.hoverBg};
    }

    &.selected {
      background: ${(props) => props.theme.plainGrid.hoverBg};
      color: ${(props) => props.theme.colors.text.white};
    }

    .change-path {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-family: monospace;
      font-size: ${(props) => props.theme.font.size.sm};
    }

    .change-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }
  }

  .change-status {
    flex-shrink: 0;
    width: 1.25rem;
    text-align: center;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.sm};
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

    &.conflicted {
      color: ${(props) => props.theme.colors.text.danger};
    }
  }

  .empty-group {
    padding: 6px 2px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .too-many-files {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 10px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.status.warning.text};
    background: ${(props) => props.theme.status.warning.background};
    border-radius: ${(props) => props.theme.border.radius.sm};
  }
`;

export default StyledWrapper;
