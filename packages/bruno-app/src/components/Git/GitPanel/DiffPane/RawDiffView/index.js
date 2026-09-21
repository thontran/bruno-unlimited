import React, { useMemo, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { buildRows } from 'components/OpenAPISyncTab/SpecDiffModal/buildRows';
import { createHighlightCache } from 'components/OpenAPISyncTab/SpecDiffModal/highlightCache';
import DiffRow from 'components/OpenAPISyncTab/SpecDiffModal/DiffRow';

/**
 * Side-by-side renderer for a unified diff, reusing the same Diff2Html parse → row flattening →
 * virtualized rows pipeline as the OpenAPI spec diff. `Diff2Html` is the UMD bundle loaded in
 * `src/index.js`; when it is unavailable (or the patch is unparseable) the raw patch text is
 * shown instead of failing.
 */
const RawDiffView = ({ raw }) => {
  const [cache] = useState(createHighlightCache);

  const rows = useMemo(() => {
    const { Diff2Html } = window;
    if (!Diff2Html || !raw) {
      return null;
    }

    try {
      const parsed = Diff2Html.parse(raw, { outputFormat: 'side-by-side', matching: 'lines' });
      return buildRows(parsed).rows;
    } catch (error) {
      console.error('GitPanel: failed to parse unified diff', error);
      return null;
    }
  }, [raw]);

  if (!raw) {
    return <div className="diff-empty">No textual changes.</div>;
  }

  if (!rows) {
    return (
      <pre className="diff-raw-text" data-testid="git-diff-raw-text">
        {raw}
      </pre>
    );
  }

  if (!rows.length) {
    return <div className="diff-empty">No changes to display.</div>;
  }

  return (
    <div className="diff-rows" data-testid="git-diff-rows">
      <Virtuoso
        totalCount={rows.length}
        itemContent={(index) => <DiffRow row={rows[index]} cache={cache} />}
        // Must match the .diff-row min-height in this component's StyledWrapper.
        fixedItemHeight={18}
        increaseViewportBy={400}
        style={{ height: '100%' }}
      />
    </div>
  );
};

export default RawDiffView;
