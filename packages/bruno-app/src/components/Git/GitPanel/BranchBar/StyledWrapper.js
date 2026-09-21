import styled from 'styled-components';

const StyledWrapper = styled.div`
  border-bottom: 1px solid ${(props) => props.theme.table.border};

  .branch-trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    font-size: ${(props) => props.theme.font.size.base};
    font-weight: 500;
    background: transparent;
    color: inherit;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    cursor: pointer;

    &:hover {
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  .branch-option {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    width: 100%;
    padding: 5px 10px;
    font-size: ${(props) => props.theme.font.size.sm};
    background: transparent;
    color: ${(props) => props.theme.dropdown.color};
    cursor: pointer;

    &:hover {
      background: ${(props) => props.theme.dropdown.hoverBg};
    }

    &.current {
      color: ${(props) => props.theme.dropdown.selectedColor};
    }
  }

  .branch-empty {
    padding: 5px 10px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.dropdown.mutedText};
  }

  .new-branch-input {
    width: 18ch;
    padding: 4px 8px;
    font-size: ${(props) => props.theme.font.size.sm};
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.input.bg};
    color: inherit;

    &:focus {
      outline: none;
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  .sync-badge {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-size: ${(props) => props.theme.font.size.xs};
    font-weight: 600;

    &.ahead {
      color: ${(props) => props.theme.status.success.text};
    }

    &.behind {
      color: ${(props) => props.theme.status.warning.text};
    }
  }

  .remote-url {
    font-size: ${(props) => props.theme.font.size.sm};
    font-family: monospace;
    color: ${(props) => props.theme.colors.text.muted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .progress-log {
    max-height: 96px;
    overflow-y: auto;
    padding: 6px 8px;
    font-family: monospace;
    font-size: ${(props) => props.theme.font.size.xs};
    line-height: 1.5;
    white-space: pre-wrap;
    color: ${(props) => props.theme.colors.text.muted};
    background: ${(props) => props.theme.background.mantle};
    border: 1px solid ${(props) => props.theme.border.border1};
    border-radius: ${(props) => props.theme.border.radius.sm};
  }
`;

export default StyledWrapper;
