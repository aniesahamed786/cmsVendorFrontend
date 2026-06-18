export type OfferStatus = 'Active' | 'Rejected' | 'Ending Soon';

export type RequestStatus = 'Ending Soon' | 'In-Progress' | 'Action Required';

export interface VendorDateSummary {
  label: string;
  value: string;
  icon: string;
}

export interface VendorLocation {
  id: number;
  name: string;
  address: string;
}

export interface VendorOfferSummary {
  id: string;
  title: string;
  expiresOn: string;
  status: OfferStatus;
  icon: string;
}

export interface VendorRequestSummary {
  id: string;
  title: string;
  status: RequestStatus;
}

export interface VendorContact {
  name: string;
  role: string;
  phone: string;
  email: string;
}

export interface VendorApprover {
  name: string;
  title: string;
  avatarLabel: string;
}

export interface VendorProfile {
  name: string;
  crNumber: string;
  location: string;
  lastActivity: string;
  contractStatus: string;
  description: string;
  tags: string[];
  dateSummaries: VendorDateSummary[];
  locations: VendorLocation[];
  offers: VendorOfferSummary[];
  requests: VendorRequestSummary[];
  primaryContact: VendorContact;
  secondaryContact: VendorContact;
  approvedBy: VendorApprover;
}
