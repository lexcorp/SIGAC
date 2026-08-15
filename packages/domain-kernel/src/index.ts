export type Brand<T, Name extends string> = T & { readonly __brand: Name };

export type EntityId = Brand<string, 'EntityId'>;

export interface DomainEvent<TPayload = unknown> {
  readonly name: string;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export class DomainError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'DomainError';
  }
}
