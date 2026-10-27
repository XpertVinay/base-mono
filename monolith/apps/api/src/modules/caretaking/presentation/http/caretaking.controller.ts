import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { OnboardCaretakerUseCase } from '../../application/commands/onboard-caretaker.use-case.js';
import { AssignCaretakerUseCase } from '../../application/commands/assign-caretaker.use-case.js';
import { AcceptAssignmentUseCase } from '../../application/commands/accept-assignment.use-case.js';
import { UpdatePermissionsUseCase } from '../../application/commands/update-permissions.use-case.js';
import { ListCaretakersQuery } from '../../application/queries/list-caretakers.query.js';
import { ListAssignmentsQuery } from '../../application/queries/list-assignments.query.js';
import { getCurrentRequestId } from '../../../../shared/presentation/request-context.js';

const onboardCaretakerSchema = z.object({
  phone: z.string().min(6),
  experienceYears: z.number().min(0),
  serviceCities: z.array(z.string()).min(1),
  skills: z.array(z.string()).default([])
});

const permissionScopeEnum = z.enum([
  'VIEW_PROPERTY',
  'KEY_ACCESS',
  'INSPECT_PREMISES',
  'SOLICIT_QUOTES',
  'AUTHORIZE_REPAIRS_WITHIN_LIMIT',
  'CONDUCT_VISITS',
  'COLLECT_RENT_PROOF'
]);

const assignCaretakerSchema = z.object({
  propertyId: z.string().min(1),
  caretakerId: z.string().min(1),
  monthlyFee: z.number().min(0),
  allowedPermissions: z.array(permissionScopeEnum),
  spendingThresholdLimit: z.number().min(0).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

const updatePermissionsSchema = z.object({
  allowedPermissions: z.array(permissionScopeEnum),
  spendingThresholdLimit: z.number().min(0).optional()
});

export class CaretakingController {
  constructor(
    private readonly onboardCaretakerUseCase: OnboardCaretakerUseCase,
    private readonly assignCaretakerUseCase: AssignCaretakerUseCase,
    private readonly acceptAssignmentUseCase: AcceptAssignmentUseCase,
    private readonly updatePermissionsUseCase: UpdatePermissionsUseCase,
    private readonly listCaretakersQuery: ListCaretakersQuery,
    private readonly listAssignmentsQuery: ListAssignmentsQuery
  ) {}

  onboard = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = onboardCaretakerSchema.parse(req.body);
      const userId = req.user!.id;
      const result = await this.onboardCaretakerUseCase.execute({ ...validated, userId, name: req.user!.email });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  assign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validated = assignCaretakerSchema.parse(req.body);
      const ownerId = req.user!.id;
      const result = await this.assignCaretakerUseCase.execute({ ...validated, ownerId, startDate: validated.startDate || new Date().toISOString() });

      if (result.isFailure) return next(result.getError());

      res.status(201).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  acceptAssignment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assignmentId = String(req.params.id);
      const caretakerUserId = req.user!.id;
      const result = await this.acceptAssignmentUseCase.execute({ assignmentId, caretakerUserId });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  updatePermissions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const assignmentId = String(req.params.id);
      const validated = updatePermissionsSchema.parse(req.body);
      const ownerId = req.user!.id;

      const result = await this.updatePermissionsUseCase.execute({
        assignmentId,
        ownerId,
        allowedPermissions: validated.allowedPermissions,
        spendingThresholdLimit: validated.spendingThresholdLimit
      });

      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listCaretakers = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.listCaretakersQuery.execute();
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };

  listAssignments = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const propertyId = req.query.propertyId as string | undefined;
      const ownerId = req.user!.role === 'OWNER' ? req.user!.id : undefined;
      const caretakerId = req.user!.role === 'CARETAKER' ? req.user!.id : undefined;

      const result = await this.listAssignmentsQuery.execute({ propertyId, ownerId, caretakerId });
      if (result.isFailure) return next(result.getError());

      res.status(200).json({
        success: true,
        data: result.getValue(),
        meta: { requestId: getCurrentRequestId(), timestamp: new Date().toISOString() }
      });
    } catch (err) {
      next(err);
    }
  };
}
