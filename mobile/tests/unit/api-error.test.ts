import { ApiError } from '../../src/core/api/apiError';

describe('ApiError Normalization', () => {
  it('creates ApiError from standard response payload', () => {
    const error = ApiError.fromResponse(400, {
      message: 'Invalid credentials',
      code: 'AUTH_INVALID',
      fieldErrors: { email: ['Email not registered'] },
    });

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
    expect(error.code).toBe('AUTH_INVALID');
    expect(error.message).toBe('Invalid credentials');
    expect(error.fieldErrors?.email).toContain('Email not registered');
  });

  it('normalizes unauthorized errors with standard message and 401 status', () => {
    const err = ApiError.unauthorized();
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
  });

  it('normalizes timeout errors with 408 status', () => {
    const err = ApiError.timeoutError();
    expect(err.status).toBe(408);
    expect(err.code).toBe('REQUEST_TIMEOUT');
  });

  it('normalizes network connection errors', () => {
    const err = ApiError.networkError(new Error('Connection refused'));
    expect(err.status).toBe(0);
    expect(err.code).toBe('NETWORK_ERROR');
  });
});
