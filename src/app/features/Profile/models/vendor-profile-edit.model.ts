export interface VendorProfileEditLocation {
  id: string;
  nameEn: string;
  nameAr: string;
  country: string;
  region: string;
  city: string;
  address: string;
  mapLink: string;
  representativeName: string;
  phone: string;
}

export interface VendorProfileEditData {
  nameEn: string;
  nameAr: string;
  crNumber: string;
  descriptionEn: string;
  descriptionAr: string;
  businessPhone: string;
  businessEmail: string;
  businessWebsite: string;
  repFullName: string;
  repPhone: string;
  repEmail: string;
  socialLinks: string[];
  locations: VendorProfileEditLocation[];
}
