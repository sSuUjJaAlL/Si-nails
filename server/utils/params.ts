import { Request } from 'express';
import { AppError } from './errors.js';

export function getParamId(req: Request, name = 'id'): string {
  const value = req.params[name];
  const id = Array.isArray(value) ? value[0] : value;
  if (!id) throw new AppError('Missing id', 400);
  return id;
}
