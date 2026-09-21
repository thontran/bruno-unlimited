import styled from 'styled-components';

const StyledWrapper = styled.div`
  .commit-message {
    width: 100%;
    min-height: 64px;
    padding: 6px 8px;
    font-size: ${(props) => props.theme.font.size.sm};
    line-height: 1.4;
    resize: vertical;
    border: 1px solid ${(props) => props.theme.input.border};
    border-radius: ${(props) => props.theme.border.radius.sm};
    background: ${(props) => props.theme.input.bg};
    color: inherit;

    &::placeholder {
      color: ${(props) => props.theme.input.placeholder.color};
      opacity: ${(props) => props.theme.input.placeholder.opacity};
    }

    &:focus {
      outline: none;
      border-color: ${(props) => props.theme.input.focusBorder};
    }
  }

  .commit-hint {
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }
`;

export default StyledWrapper;
