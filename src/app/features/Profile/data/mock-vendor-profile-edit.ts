import { VendorProfileEditData } from '../models/vendor-profile-edit.model';

export const MOCK_VENDOR_PROFILE_EDIT: VendorProfileEditData = {
  nameEn: 'Lumee Street',
  nameAr: 'لومي ستريت',
  crNumber: '1010456789',
  descriptionEn:
    'Lumee Street is a contemporary dining destination known for fresh flavors and a vibrant atmosphere.',
  descriptionAr: 'لومي ستريت وجهة طعام عصرية معروفة بنكهاتها الطازجة وأجوائها النابضة بالحياة.',
  businessPhone: '+966 50 123 4567',
  businessEmail: 'contact@lumeestreet.com',
  businessWebsite: 'https://www.lumeestreet.com',
  repFullName: 'John Doe',
  repPhone: '+966 55 987 6543',
  repEmail: 'john.doe@lumeestreet.com',
  socialLinks: [
    { platform: 'instagram', accountName: 'lumeestreet', url: 'https://instagram.com/lumeestreet' },
    { platform: 'facebook', accountName: 'lumeestreet', url: 'https://facebook.com/lumeestreet' },
    { platform: 'x', accountName: 'lumeestreet', url: 'https://x.com/lumeestreet' },
    { platform: 'whatsapp', accountName: 'Lumee Support', url: 'https://wa.me/966501234567' },
  ],
  locations: [
    {
      id: '1',
      nameEn: 'Dammam Branch',
      nameAr: 'فرع الدمام',
      country: 'Saudi Arabia',
      region: 'Eastern Region',
      city: 'Dammam',
      address: 'King Fahd Road, Al Faisaliyah, Dammam 32272',
      mapLink: 'https://maps.google.com',
      representativeName: 'Ahmed Ali',
      phone: '+966 50 111 2233',
    },
  ],
};
