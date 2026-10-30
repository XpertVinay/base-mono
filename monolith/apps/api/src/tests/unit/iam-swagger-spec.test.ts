import { describe, it, expect } from 'vitest';
import { openApiSpec } from '../../infrastructure/docs/swagger-spec.js';

describe('IAM Module - Swagger & OpenAPI 3.0 Documentation', () => {
  it('exposes IAM tag in openApiSpec tags', () => {
    const tag = openApiSpec.tags.find((t: any) => t.name === 'IAM - Identity & Access Management');
    expect(tag).toBeDefined();
    expect(tag?.description).toContain('User registration, authentication');
  });

  it('exposes all IAM endpoints in openApiSpec paths', () => {
    const paths = (openApiSpec as any).paths;
    expect(paths['/api/iam/register']).toBeDefined();
    expect(paths['/api/iam/login']).toBeDefined();
    expect(paths['/api/iam/refresh']).toBeDefined();
    expect(paths['/api/iam/me']).toBeDefined();

    // Verify /api/iam/register
    const registerPost = paths['/api/iam/register'].post;
    expect(registerPost.tags).toContain('IAM - Identity & Access Management');
    expect(registerPost.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/RegisterUserRequest'
    );
    expect(registerPost.responses['201']).toBeDefined();
    expect(registerPost.responses['400']).toBeDefined();
    expect(registerPost.responses['409']).toBeDefined();

    // Verify /api/iam/login
    const loginPost = paths['/api/iam/login'].post;
    expect(loginPost.tags).toContain('IAM - Identity & Access Management');
    expect(loginPost.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/LoginUserRequest'
    );
    expect(loginPost.responses['200']).toBeDefined();
    expect(loginPost.responses['401']).toBeDefined();

    // Verify /api/iam/refresh
    const refreshPost = paths['/api/iam/refresh'].post;
    expect(refreshPost.tags).toContain('IAM - Identity & Access Management');
    expect(refreshPost.requestBody.content['application/json'].schema.$ref).toBe(
      '#/components/schemas/RefreshTokenRequest'
    );
    expect(refreshPost.responses['200']).toBeDefined();
    expect(refreshPost.responses['401']).toBeDefined();

    // Verify /api/iam/me
    const meGet = paths['/api/iam/me'].get;
    expect(meGet.tags).toContain('IAM - Identity & Access Management');
    expect(meGet.security).toEqual([{ BearerAuth: [] }]);
    expect(meGet.responses['200']).toBeDefined();
    expect(meGet.responses['401']).toBeDefined();
  });

  it('exposes IAM schemas in openApiSpec components.schemas', () => {
    const schemas = (openApiSpec as any).components.schemas;
    expect(schemas.UserRole).toBeDefined();
    expect(schemas.UserDto).toBeDefined();
    expect(schemas.RegisterUserRequest).toBeDefined();
    expect(schemas.LoginUserRequest).toBeDefined();
    expect(schemas.RefreshTokenRequest).toBeDefined();
    expect(schemas.AuthTokensResponse).toBeDefined();
    expect(schemas.AuthTokensResponse.properties.idToken).toBeDefined();
    expect(schemas.AuthTokensResponse.properties.accessToken).toBeDefined();
    expect(schemas.AuthTokensResponse.properties.refreshToken).toBeDefined();
  });

  it('exposes Conflict and TooManyRequests in components.responses', () => {
    const responses = (openApiSpec as any).components.responses;
    expect(responses.Conflict).toBeDefined();
    expect(responses.TooManyRequests).toBeDefined();
  });
});

