/**
 * Response shape for `GET /api/v1/cmsVendor/requests/:requestId` — confirmed
 * against a real response. Ideally this lives alongside `CreateRequestPayload`
 * in `request-center/models/request-api.model`; declared here for now since
 * that file wasn't provided.
 */
export interface RequestCenterRequestRecord<TRequestData = Record<string, unknown>> {
  _id: string;
  requestId: string;
  entityType: string;
  /** null until the request is approved and the entity actually gets created —
   * a DRAFT (or a pending CREATE) will have entityId: null. */
  entityId: string | null;
  requestType: 'CREATE' | 'UPDATE';
  vendorId: string;
  title: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  requestData: TRequestData;
  adminAction: unknown;
  createdBy: string;
  createdOn: string;
  updatedOn: string;
  submittedOn: string | null;
  current: unknown;
  changes: unknown[];
}