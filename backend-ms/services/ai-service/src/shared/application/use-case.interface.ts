import { Result } from '../domain/result.js';

export interface UseCase<IRequest, IResponse, IError = string> {
  execute(request: IRequest): Promise<Result<IResponse, IError>>;
}

