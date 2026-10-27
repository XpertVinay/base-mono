import crypto from 'crypto';
import {
  MaintenancePriority,
  MaintenanceStatus,
  MaintenanceCategory,
  SlaTargetDto,
  QuotationDto,
  ProofOfWorkDto
} from '@monolith/contracts';

export class MaintenanceRequest {
  private constructor(
    public readonly id: string,
    public readonly propertyId: string,
    public readonly reporterId: string,
    public readonly reporterRole: string,
    public readonly category: MaintenanceCategory,
    public priority: MaintenancePriority,
    private _status: MaintenanceStatus,
    public title: string,
    public description: string,
    public photoUrls: string[],
    public sla: SlaTargetDto,
    public isEmergencyFloatCovered: boolean,
    public emergencyAmountDrawn: number,
    public quotations: QuotationDto[],
    public selectedQuotation: QuotationDto | null,
    public proofOfWork: ProofOfWorkDto | null,
    public readonly createdAt: Date,
    public updatedAt: Date
  ) {}

  public static create(
    propertyId: string,
    reporterId: string,
    reporterRole: string,
    category: MaintenanceCategory,
    title: string,
    description: string,
    photoUrls: string[] = [],
    reportedUrgency: 'EMERGENCY' | 'URGENT' | 'NORMAL' | 'LOW' = 'NORMAL',
    ownerEmergencyLimit: number = 5000
  ): MaintenanceRequest {
    if (!title || title.trim().length < 3) {
      throw new Error('Maintenance title must be at least 3 characters long');
    }

    // Dynamic Priority Triage based on category and reported urgency
    let priority: MaintenancePriority = 'P3_STANDARD';
    if (
      reportedUrgency === 'EMERGENCY' ||
      category === 'PLUMBING' ||
      category === 'ELECTRICAL' ||
      category === 'STRUCTURAL_SEEPAGE'
    ) {
      if (category === 'PLUMBING' || category === 'ELECTRICAL' || category === 'STRUCTURAL_SEEPAGE') {
        priority = 'P1_EMERGENCY';
      } else {
        priority = 'P2_URGENT';
      }
    } else if (reportedUrgency === 'URGENT' || category === 'SECURITY_LOCKS' || category === 'HVAC_COOLING') {
      priority = 'P2_URGENT';
    } else if (category === 'PAINTING_AESTHETICS') {
      priority = 'P4_ROUTINE';
    }

    const now = new Date();
    const sla = MaintenanceRequest.calculateSla(priority, now);

    // Pillar 2: Emergency Circuit Breaker Float for P1 Emergencies
    const isEmergency = priority === 'P1_EMERGENCY';
    const status: MaintenanceStatus = isEmergency ? 'EMERGENCY_MOBILIZED' : 'REPORTED';
    const emergencyDrawn = isEmergency ? Math.min(ownerEmergencyLimit, 5000) : 0;

    return new MaintenanceRequest(
      crypto.randomUUID(),
      propertyId,
      reporterId,
      reporterRole,
      category,
      priority,
      status,
      title.trim(),
      description.trim(),
      photoUrls,
      sla,
      isEmergency,
      emergencyDrawn,
      [],
      null,
      null,
      now,
      now
    );
  }

  public static reconstruct(props: {
    id: string;
    propertyId: string;
    reporterId: string;
    reporterRole: string;
    category: MaintenanceCategory;
    priority: MaintenancePriority;
    status: MaintenanceStatus;
    title: string;
    description: string;
    photoUrls: string[];
    sla: SlaTargetDto;
    isEmergencyFloatCovered: boolean;
    emergencyAmountDrawn: number;
    quotations: QuotationDto[];
    selectedQuotation: QuotationDto | null;
    proofOfWork: ProofOfWorkDto | null;
    createdAt: Date;
    updatedAt: Date;
  }): MaintenanceRequest {
    return new MaintenanceRequest(
      props.id,
      props.propertyId,
      props.reporterId,
      props.reporterRole,
      props.category,
      props.priority,
      props.status,
      props.title,
      props.description,
      props.photoUrls,
      props.sla,
      props.isEmergencyFloatCovered,
      props.emergencyAmountDrawn,
      props.quotations,
      props.selectedQuotation,
      props.proofOfWork,
      props.createdAt,
      props.updatedAt
    );
  }

  public get status(): MaintenanceStatus {
    return this._status;
  }

  public addQuotation(vendorId: string, vendorName: string, estimatedCost: number, breakdown: string): QuotationDto {
    if (this._status === 'COMPLETED') {
      throw new Error('Cannot add quotation to a completed maintenance request');
    }
    const quotation: QuotationDto = {
      id: crypto.randomUUID(),
      vendorId,
      vendorName,
      estimatedCost,
      breakdown,
      validUntil: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      isOwnerApproved: false
    };
    this.quotations.push(quotation);
    if (this._status === 'REPORTED' || this._status === 'TRIAGED') {
      this._status = 'QUOTED';
    }
    this.updatedAt = new Date();
    return quotation;
  }

  public approveQuotation(quotationId: string, approverRole: string, caretakerLimit: number = 0): void {
    const q = this.quotations.find(item => item.id === quotationId);
    if (!q) {
      throw new Error(`Quotation ${quotationId} not found`);
    }

    // Server-side permission check: Caretaker can only approve if within spending limit
    if (approverRole === 'CARETAKER' && q.estimatedCost > caretakerLimit) {
      throw new Error(`Cost ₹${q.estimatedCost} exceeds caretaker spending limit of ₹${caretakerLimit}. Owner approval required.`);
    }

    q.isOwnerApproved = true;
    q.approvedAt = new Date().toISOString();
    this.selectedQuotation = q;
    this._status = 'APPROVED';
    this.updatedAt = new Date();
  }

  public completeWork(proof: ProofOfWorkDto): void {
    if (this._status === 'COMPLETED') return;

    if (!proof.beforePhotoUrls.length || !proof.afterPhotoUrls.length) {
      throw new Error('Proof of work requires both before and after photo documentation');
    }
    if (!proof.gpsLatitude || !proof.gpsLongitude) {
      throw new Error('Anti-fraud GPS check-in verification is mandatory for work completion');
    }

    this.proofOfWork = proof;
    this._status = 'COMPLETED';
    this.updatedAt = new Date();
  }

  public static calculateSla(priority: MaintenancePriority, baseTime: Date = new Date()): SlaTargetDto {
    let responseHours = 4;
    let resolutionHours = 72;

    switch (priority) {
      case 'P1_EMERGENCY':
        responseHours = 0.25; // 15 mins
        resolutionHours = 4;   // 4 hours
        break;
      case 'P2_URGENT':
        responseHours = 1;    // 1 hour
        resolutionHours = 24;  // 24 hours
        break;
      case 'P3_STANDARD':
        responseHours = 4;    // 4 hours
        resolutionHours = 72;  // 72 hours
        break;
      case 'P4_ROUTINE':
        responseHours = 24;   // 24 hours
        resolutionHours = 168; // 1 week
        break;
    }

    const responseDeadline = new Date(baseTime.getTime() + responseHours * 3600 * 1000).toISOString();
    const resolutionDeadline = new Date(baseTime.getTime() + resolutionHours * 3600 * 1000).toISOString();

    return {
      responseDeadline,
      resolutionDeadline,
      isResponseBreached: false,
      isResolutionBreached: false
    };
  }
}
