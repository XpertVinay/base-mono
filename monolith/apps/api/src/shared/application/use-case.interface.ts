import { Result } from '../domain/result.js';

export interface IUseCase<TInput, TOutput> {
  execute(input: TInput): Promise<Result<TOutput, Error>>;
}

export interface IQuery<TInput, TOutput> {
  execute(query: TInput): Promise<Result<TOutput, Error>>;
}

export interface ICommand<TInput, TOutput> {
  execute(command: TInput): Promise<Result<TOutput, Error>>;
}
