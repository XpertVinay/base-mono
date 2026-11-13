export class Result<T, E = string> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _value?: T;
  private readonly _error?: E;

  private constructor(isSuccess: boolean, error?: E, value?: T) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._error = error;
    this._value = value;
  }

  public static ok<U>(value?: U): Result<U, never> {
    return new Result<U, never>(true, undefined, value);
  }

  public static fail<F>(error: F): Result<never, F> {
    return new Result<never, F>(false, error);
  }

  public getValue(): T {
    if (!this.isSuccess) {
      throw new Error('Cannot retrieve the value from a failed result.');
    }
    return this._value as T;
  }

  public getError(): E {
    if (this.isSuccess) {
      throw new Error('Cannot retrieve the error from a successful result.');
    }
    return this._error as E;
  }
}
