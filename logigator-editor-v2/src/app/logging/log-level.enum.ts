/**
 * Console log severities, ordered from most to least verbose. A message is
 * printed only when its level is `>=` the configured
 * {@link Environment.loggingVerbosity}; `Silent` suppresses everything.
 */
export enum LogLevel {
  Debug = 0,
  Info = 1,
  Warn = 2,
  Error = 3,
  Silent = 4
}
