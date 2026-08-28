/**
 * Public surface of the share module. React free on purpose, so a tool handler can import
 * it without pulling a view in: the shared board component lives in ./SharedBoard.
 */

export { buildShareUrl, hasShareFragment, readShareFromLocation, readSharePayload, readShareParam, SHARE_PARAM } from "./url";
export { fromSnapshot, toSnapshot, SHARED_SUFFIX, SNAPSHOT_VERSION } from "./snapshot";
export type { Snapshot } from "./snapshot";
export { hasCompression, packBytes, unpackPayload } from "./codec";
