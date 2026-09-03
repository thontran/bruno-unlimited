import isEqual from 'lodash/isEqual';
import get from 'lodash/get';
import VisualDiffUrlBar from 'components/Git/VisualDiffViewer/VisualDiffUrlBar';
import VisualDiffParams from 'components/Git/VisualDiffViewer/VisualDiffParams';
import VisualDiffHeaders from 'components/Git/VisualDiffViewer/VisualDiffHeaders';
import VisualDiffAuth from 'components/Git/VisualDiffViewer/VisualDiffAuth';
import VisualDiffBody from 'components/Git/VisualDiffViewer/VisualDiffBody';

// `visual.before.parsed` / `visual.after.parsed` are `parseRequest` output, so every section
// reads the same `request.*` paths the VisualDiff* components expect.
const SECTION_DATA_PATHS = {
  url: ['request.url', 'request.method'],
  params: 'request.params',
  headers: 'request.headers',
  auth: 'request.auth',
  body: 'request.body'
};

const hasContent = {
  url: (data) => Boolean(data.request?.url || data.request?.method),
  params: (data) => Boolean(data.request?.params?.length),
  headers: (data) => Boolean(data.request?.headers?.length),
  auth: (data) => Boolean(data.request?.auth?.mode && data.request.auth.mode !== 'none'),
  body: (data) => Boolean(data.request?.body?.mode && data.request.body.mode !== 'none')
};

/** Section list handed to `VisualDiffContent`; module-level so its effect deps stay stable. */
export const gitDiffSections = [
  { key: 'url', title: 'URL', Component: VisualDiffUrlBar, hasContent: hasContent.url },
  { key: 'params', title: 'Parameters', Component: VisualDiffParams, hasContent: hasContent.params },
  { key: 'headers', title: 'Headers', Component: VisualDiffHeaders, hasContent: hasContent.headers },
  { key: 'auth', title: 'Authentication', Component: VisualDiffAuth, hasContent: hasContent.auth },
  { key: 'body', title: 'Body', Component: VisualDiffBody, hasContent: hasContent.body }
];

/** Unlike the OpenAPI diff, both sides come from the same on-disk format, so a deep compare is enough. */
export const gitSectionHasChanges = (sectionKey, oldData, newData) => {
  const paths = SECTION_DATA_PATHS[sectionKey];

  if (Array.isArray(paths)) {
    return paths.some((dataPath) => !isEqual(get(oldData, dataPath), get(newData, dataPath)));
  }

  return !isEqual(get(oldData, paths), get(newData, paths));
};
