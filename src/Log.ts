import { Cause, Inspectable, Logger, Match, PlatformError, Predicate, References } from 'effect';

const pad = (value: number, length = 2) => value.toString().padStart(length, '0');

const time = (date: Date) =>
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;

const quoted = (text: string) => (/[\s"=]/.test(text) ? JSON.stringify(text) : text);

/**
 * An expected error in a sentence. A file system error's own message only
 * names the call, so the reason the system gave, such as `EROFS: read-only
 * file system`, comes from its cause.
 */
const describe = ({ error }: Cause.Fail<unknown>) => {
  if (
    PlatformError.isPlatformError(error) &&
    !Predicate.isTagged(error.reason, 'BadArgument') &&
    Predicate.isError(error.cause)
  ) {
    return `${error.reason.module}.${error.reason.method} failed: ${error.cause.message}`;
  }

  return Predicate.isError(error) ? error.message : Inspectable.toStringUnknown(error, 0);
};

/** Errors as one line each. Defects, which are bugs, keep their stack trace. */
const describeCause = (cause: Cause.Cause<unknown>) =>
  cause.reasons
    .flatMap((reason) =>
      Match.value(reason).pipe(
        Match.tag('Fail', (fail) => [describe(fail)]),
        Match.tag('Die', (die) => [Cause.pretty(Cause.fromReasons([die]))]),
        Match.orElse(() => [])
      )
    )
    .join('\n');

/**
 * Like Effect's default logger, but each entry is one line, with annotations
 * as `key=value` pairs, and errors are described rather than dumped.
 */
const formatLine = Logger.make<unknown, string>(({ cause, date, fiber, logLevel, message }) => {
  const now = date.getTime();

  const spans = fiber
    .getRef(References.CurrentLogSpans)
    .map(([label, start]) => ` ${label}=${now - start}ms`)
    .join('');

  const line = [
    `[${time(date)}] ${logLevel.toUpperCase()}${spans}:`,
    ...(Array.isArray(message) ? message : [message]).map((part) =>
      Inspectable.toStringUnknown(part, 0)
    ),
    ...Object.entries(fiber.getRef(References.CurrentLogAnnotations)).map(
      ([key, annotation]) => `${key}=${quoted(Inspectable.toStringUnknown(annotation, 0))}`
    ),
  ].join(' ');

  const errors = describeCause(cause);

  return errors === '' ? line : `${line} ${errors}`;
});

export const layer = Logger.layer([Logger.withConsoleLog(formatLine)]);

export * as Log from './Log.js';
