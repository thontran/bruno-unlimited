import styled from 'styled-components';

const StyledWrapper = styled.div`
  .panel-title {
    font-size: ${(props) => props.theme.font.size.lg};
    font-weight: 500;
    line-height: 1.4;
  }

  .panel-subtitle {
    margin-top: 2px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.muted};
  }

  .section-title {
    font-size: ${(props) => props.theme.font.size.sm};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${(props) => props.theme.colors.text.muted};
  }

  .panel-error {
    padding: 8px 10px;
    font-size: ${(props) => props.theme.font.size.sm};
    color: ${(props) => props.theme.colors.text.danger};
    background: ${(props) => props.theme.status.danger.background};
    border-radius: ${(props) => props.theme.border.radius.sm};
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    height: 100%;
    text-align: center;
    color: ${(props) => props.theme.colors.text.muted};

    .empty-state-title {
      font-size: ${(props) => props.theme.font.size.base};
      font-weight: 500;
      color: ${(props) => props.theme.text};
    }

    .empty-state-text {
      max-width: 32rem;
      font-size: ${(props) => props.theme.font.size.sm};
    }
  }
`;

export default StyledWrapper;
