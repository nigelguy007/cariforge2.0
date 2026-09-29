// @polsia:user-owned — domain errors for the fundraise loop store, mapped to
// HTTP statuses in http.ts. Pure (no I/O) so tests can import them directly.

export { TransitionError } from './state';

export class NotFoundError extends Error {
  constructor(what: string) {
    super(`${what} not found`);
    this.name = 'NotFoundError';
  }
}

/** A request that is well-formed but conflicts with current state (→ 409). */
export class ConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}
