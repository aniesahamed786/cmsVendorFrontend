import { VendorProfile } from '../models/vendor-profile.model';

export const MOCK_VENDOR_PROFILE: VendorProfile = {
  name: 'Lumee Street',
  crNumber: '1010456789',
  location: 'Riyadh, Saudi Arabia',
  lastActivity: 'June 12, 2026',
  contractStatus: 'Active Contract',
  description:
    'Lumee Street is a modern casual dining brand offering fresh, flavorful meals in a vibrant and welcoming atmosphere. We specialize in high-quality retail electronics and technology supply chain solutions across the Kingdom.',
  tags: ['Retail Store', 'Electronics', 'Technology', 'Supply Chain'],
  dateSummaries: [
    { label: 'Registration Date', value: 'March 15, 2025', icon: 'pi pi-calendar' },
    { label: 'Approval Date', value: 'March 18, 2025', icon: 'pi pi-check-circle' },
    { label: 'Contract Start', value: 'April 1, 2025', icon: 'pi pi-play' },
    { label: 'Contract End', value: 'March 31, 2026', icon: 'pi pi-bullseye' },
  ],
  locations: [
    {
      id: 1,
      name: 'Riyadh Main Store',
      address: 'King Fahd Road, Al Olaya, Riyadh 12211',
    },
    {
      id: 2,
      name: 'Jeddah Store',
      address: 'Prince Sultan Street, Al Rawdah, Jeddah 23432',
    },
    {
      id: 3,
      name: 'Dammam Store',
      address: 'King Fahd Road, Al Faisaliyah, Dammam 32272',
    },
  ],
  offers: [
    {
      id: '1',
      title: '25% Off on all Electronics',
      expiresOn: 'Expires Aug 30, 2026',
      status: 'Active',
      icon: 'pi pi-percentage',
    },
    {
      id: '2',
      title: 'Family Dining Package',
      expiresOn: 'Expires Jul 15, 2026',
      status: 'Rejected',
      icon: 'pi pi-shopping-bag',
    },
    {
      id: '3',
      title: 'Summer Collection Sale',
      expiresOn: 'Expires Jun 28, 2026',
      status: 'Ending Soon',
      icon: 'pi pi-tag',
    },
    {
      id: '4',
      title: 'Weekend Brunch Special',
      expiresOn: 'Expires Sep 10, 2026',
      status: 'Active',
      icon: 'pi pi-percentage',
    },
  ],
  requests: [
    { id: '1', title: 'Khobar Expansion', status: 'Ending Soon' },
    { id: '2', title: 'Menu Update Request', status: 'In-Progress' },
    { id: '3', title: 'Contract Renewal', status: 'Action Required' },
  ],
  primaryContact: {
    name: 'John Doe',
    role: 'Primary POC',
    phone: '+966 50 123 4567',
    email: 'john.doe@lumeestreet.com',
  },
  secondaryContact: {
    name: 'Jane Smith',
    role: 'Secondary Contact',
    phone: '+966 55 987 6543',
    email: 'jane.smith@lumeestreet.com',
  },
  approvedBy: {
    name: 'Sarah Johnson',
    title: 'Head of Procurement',
    avatarLabel: 'SJ',
  },
};
