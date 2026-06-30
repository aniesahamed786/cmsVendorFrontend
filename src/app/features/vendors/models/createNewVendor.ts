export interface VendorSocialLink {
  platform?: string;
  accountName?: string;
  url: string;
}

export interface CreateVendor {
  name: string;                     // required
  name_ar?: string;                 // optional
  description?: string;             // optional
  description_ar?: string;          // optional

  website?: string[];               // array<string>
  crn_no: string;                   // required

  email?: string[];                 // array<string>
  mobile?: string[];                // array<string>
  telephone?: string[];             // array<string>
  socialLinks?: VendorSocialLink[]; // array<object>

  locations?: VendorLocation[];     // array<object>

  categories?: string[];            // array of category IDs

  searchKeywords?: string[];        // array<string>

  smeName?: string;
  smeEmail?: string;
  smePhone?: string;

  isActive?: boolean;               // legacy field; avoid relying on it as source of truth

  logo?: File | null | string;      // File = upload; string = existing URL (edit); null = removed
  coverImage?: File | null | string; // vendor banner / cover (same semantics as logo)
  coverImageLandscape?: File | null | string;
}

export interface VendorLocation {
  [key: string]: any;   // allows any object structure
}
