import { useState } from 'react';
import { supabase } from '../lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PainterFormData {
  // Step 1
  companyName: string;
  ownerName: string;
  email: string;
  phone: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  website: string;
  yearsInBusiness: number | null;
  crewSize: number | null;

  // Step 2
  hasLicense: boolean;
  licenseNumber: string;
  licenseState: string;
  licenseExpiration: string;
  isBonded: boolean;
  bondingCompany: string;
  bondAmount: string;
  isInsured: boolean;
  insuranceCompany: string;
  policyNumber: string;
  coverageAmount: string;
  hasWorkersComp: boolean;
  workersCompCarrier: string;
  certifications: string[];
  otherCertification: string;

  // Step 3
  serviceTypes: string[];
  serviceAreaZips: string;
  maxProjectSize: string;
  projectsPerMonth: number | null;
  offersEstimates: boolean;
  offersWarranty: boolean;
  warrantyLength: string;

  // Step 4
  price1BRFull: number | null;
  price3BRWalls: number | null;
  price3BRTrimDoors: number | null;
  price3BRCeilings: number | null;
  price5BRFull: number | null;
  price5BRCabinets: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US_STATES: { value: string; label: string }[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'District of Columbia' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const CERTIFICATION_OPTIONS = [
  'EPA Lead-Safe Certified',
  'OSHA Certified',
  'Master Painter Certified',
  'Other',
];

const SERVICE_TYPE_OPTIONS = [
  'Interior Residential',
  'Exterior Residential',
  'Interior Commercial',
  'Exterior Commercial',
  'Cabinet Refinishing',
  'Deck/Fence Staining',
  'Pressure Washing',
  'Drywall Repair',
  'Wallpaper Removal',
  'Color Consulting',
];

const PROJECT_SIZE_OPTIONS = [
  { value: 'small', label: 'Small (1-2 rooms)' },
  { value: 'medium', label: 'Medium (whole house interior)' },
  { value: 'large', label: 'Large (full interior + exterior)' },
  { value: 'commercial', label: 'Commercial' },
];

const STEP_LABELS = [
  'Company Info',
  'Licensing',
  'Services',
  'Pricing',
];

const PRICING_SCENARIOS: {
  key: keyof Pick<
    PainterFormData,
    'price1BRFull' | 'price3BRWalls' | 'price3BRTrimDoors' | 'price3BRCeilings' | 'price5BRFull' | 'price5BRCabinets'
  >;
  label: string;
  description: string;
}[] = [
  {
    key: 'price1BRFull',
    label: '1BR Rental - Full Interior + Cabinets',
    description:
      'An empty 1-bedroom rental property \u2014 ceilings, walls, trim, doors, and kitchen cabinets.',
  },
  {
    key: 'price3BRWalls',
    label: '3BR Home - Walls Only',
    description:
      'A standard 3-bedroom home \u2014 walls only, no trim, doors, or ceilings.',
  },
  {
    key: 'price3BRTrimDoors',
    label: '3BR Home - Trim & Doors Only',
    description:
      'The same standard 3-bedroom home \u2014 all trim and doors only, no walls or ceilings.',
  },
  {
    key: 'price3BRCeilings',
    label: '3BR Home - Ceilings Only',
    description:
      'The same standard 3-bedroom home \u2014 all ceilings only, no walls, trim, or doors.',
  },
  {
    key: 'price5BRFull',
    label: '5BR Large Home - Full Interior',
    description:
      'A large 5-bedroom, 3,500 sq ft home \u2014 walls, ceilings, trim, and doors.',
  },
  {
    key: 'price5BRCabinets',
    label: '5BR Large Home - Kitchen Cabinets Only',
    description:
      'The kitchen cabinets in that same large 5-bedroom, 3,500 sq ft home.',
  },
];

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const initialFormData: PainterFormData = {
  companyName: '',
  ownerName: '',
  email: '',
  phone: '',
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  website: '',
  yearsInBusiness: null,
  crewSize: null,

  hasLicense: false,
  licenseNumber: '',
  licenseState: '',
  licenseExpiration: '',
  isBonded: false,
  bondingCompany: '',
  bondAmount: '',
  isInsured: false,
  insuranceCompany: '',
  policyNumber: '',
  coverageAmount: '',
  hasWorkersComp: false,
  workersCompCarrier: '',
  certifications: [],
  otherCertification: '',

  serviceTypes: [],
  serviceAreaZips: '',
  maxProjectSize: '',
  projectsPerMonth: null,
  offersEstimates: true,
  offersWarranty: false,
  warrantyLength: '',

  price1BRFull: null,
  price3BRWalls: null,
  price3BRTrimDoors: null,
  price3BRCeilings: null,
  price5BRFull: null,
  price5BRCabinets: null,
};

// ---------------------------------------------------------------------------
// Shared inline-style helpers (matching the site dark theme)
// ---------------------------------------------------------------------------

const styles = {
  input: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #ddd',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    background: '#333',
    color: '#fff',
    borderRadius: '0',
    outline: 'none',
  } as React.CSSProperties,
  inputError: {
    borderColor: '#e74c3c',
  } as React.CSSProperties,
  inputFocus: {
    borderColor: '#74b9ff',
  } as React.CSSProperties,
  select: {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #555',
    fontSize: '0.9rem',
    fontFamily: 'inherit',
    background: '#333',
    color: '#fff',
    borderRadius: '0',
    outline: 'none',
    appearance: 'auto' as const,
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: '#ccc',
    letterSpacing: '0.3px',
  } as React.CSSProperties,
  sectionTitle: {
    fontFamily: "'Cabin', sans-serif",
    fontSize: '1.15rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '20px',
    textTransform: 'uppercase' as const,
    letterSpacing: '1.5px',
  } as React.CSSProperties,
  helperText: {
    fontSize: '0.78rem',
    color: '#666',
    marginTop: '4px',
    lineHeight: 1.4,
  } as React.CSSProperties,
  errorText: {
    fontSize: '0.78rem',
    color: '#e74c3c',
    marginTop: '4px',
  } as React.CSSProperties,
  formGroup: {
    marginBottom: '16px',
  } as React.CSSProperties,
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  } as React.CSSProperties,
  toggleLabel: {
    fontSize: '0.9rem',
    color: '#ccc',
    fontWeight: 500,
  } as React.CSSProperties,
  toggleButton: (active: boolean): React.CSSProperties => ({
    padding: '6px 18px',
    fontSize: '0.8rem',
    fontWeight: 600,
    border: active ? '1px solid #74b9ff' : '1px solid #999',
    background: active ? '#74b9ff' : '#f0f0f0',
    color: active ? '#000' : '#444',
    cursor: 'pointer',
    transition: 'all 0.2s',
    fontFamily: 'inherit',
  }),
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    cursor: 'pointer',
  } as React.CSSProperties,
  checkboxLabel: {
    fontSize: '0.88rem',
    color: '#ccc',
    cursor: 'pointer',
    userSelect: 'none' as const,
  } as React.CSSProperties,
  card: {
    background: '#222',
    padding: '30px 28px',
    maxWidth: '700px',
    margin: '0 auto',
  } as React.CSSProperties,
  cardTitle: {
    fontFamily: "'Cabin', sans-serif",
    color: '#fff',
    fontSize: '1.05rem',
    marginBottom: '22px',
    fontWeight: 600,
  } as React.CSSProperties,
  grid2: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  } as React.CSSProperties,
  requiredStar: {
    color: '#e74c3c',
    marginLeft: '2px',
  } as React.CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PainterSignup = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<PainterFormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  // ---- helpers ----

  const updateField = <K extends keyof PainterFormData>(
    key: K,
    value: PainterFormData[K],
  ) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const toggleArrayItem = (
    key: 'certifications' | 'serviceTypes',
    item: string,
  ) => {
    setFormData((prev) => {
      const arr = prev[key] as string[];
      return {
        ...prev,
        [key]: arr.includes(item)
          ? arr.filter((i) => i !== item)
          : [...arr, item],
      };
    });
  };

  // ---- validation per step ----

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (step === 1) {
      if (!formData.companyName.trim()) newErrors.companyName = 'Required';
      if (!formData.ownerName.trim()) newErrors.ownerName = 'Required';
      if (!formData.email.trim()) newErrors.email = 'Required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
        newErrors.email = 'Enter a valid email';
      if (!formData.phone.trim()) newErrors.phone = 'Required';
      if (!formData.streetAddress.trim()) newErrors.streetAddress = 'Required';
      if (!formData.city.trim()) newErrors.city = 'Required';
      if (!formData.state) newErrors.state = 'Required';
      if (!formData.zipCode.trim()) newErrors.zipCode = 'Required';
      else if (!/^\d{5}(-\d{4})?$/.test(formData.zipCode))
        newErrors.zipCode = 'Enter a valid ZIP code';
      if (formData.yearsInBusiness === null)
        newErrors.yearsInBusiness = 'Required';
      if (formData.crewSize === null) newErrors.crewSize = 'Required';
    }

    if (step === 2) {
      if (formData.hasLicense) {
        if (!formData.licenseNumber.trim())
          newErrors.licenseNumber = 'Required when licensed';
        if (!formData.licenseState)
          newErrors.licenseState = 'Required when licensed';
        if (!formData.licenseExpiration)
          newErrors.licenseExpiration = 'Required when licensed';
      }
      if (formData.isBonded) {
        if (!formData.bondingCompany.trim())
          newErrors.bondingCompany = 'Required when bonded';
        if (!formData.bondAmount.trim())
          newErrors.bondAmount = 'Required when bonded';
      }
      if (formData.isInsured) {
        if (!formData.insuranceCompany.trim())
          newErrors.insuranceCompany = 'Required when insured';
        if (!formData.policyNumber.trim())
          newErrors.policyNumber = 'Required when insured';
        if (!formData.coverageAmount.trim())
          newErrors.coverageAmount = 'Required when insured';
      }
      if (formData.hasWorkersComp) {
        if (!formData.workersCompCarrier.trim())
          newErrors.workersCompCarrier = 'Required when carrying workers comp';
      }
    }

    if (step === 3) {
      if (formData.serviceTypes.length === 0)
        newErrors.serviceTypes = 'Select at least one service';
      if (!formData.serviceAreaZips.trim())
        newErrors.serviceAreaZips = 'Required';
      if (!formData.maxProjectSize) newErrors.maxProjectSize = 'Required';
      if (formData.projectsPerMonth === null)
        newErrors.projectsPerMonth = 'Required';
      if (formData.offersWarranty && !formData.warrantyLength.trim())
        newErrors.warrantyLength = 'Enter warranty length';
    }

    // Step 4 has no strictly required fields (pricing is optional for signup)

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---- navigation ----

  const goNext = () => {
    if (!validateStep(currentStep)) return;
    setSlideDirection('right');
    setCurrentStep((s) => Math.min(s + 1, 4));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goPrev = () => {
    setErrors({});
    setSlideDirection('left');
    setCurrentStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- submit ----

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      const { error } = await supabase.from('painters').insert({
        company_name: formData.companyName.trim(),
        owner_name: formData.ownerName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        street_address: formData.streetAddress.trim(),
        city: formData.city.trim(),
        state: formData.state,
        zip_code: formData.zipCode.trim(),
        website: formData.website.trim() || null,
        years_in_business: formData.yearsInBusiness,
        crew_size: formData.crewSize,

        has_license: formData.hasLicense,
        license_number: formData.licenseNumber.trim() || null,
        license_state: formData.licenseState || null,
        license_expiration: formData.licenseExpiration || null,
        is_bonded: formData.isBonded,
        bonding_company: formData.bondingCompany.trim() || null,
        bond_amount: formData.bondAmount.trim() || null,
        is_insured: formData.isInsured,
        insurance_company: formData.insuranceCompany.trim() || null,
        policy_number: formData.policyNumber.trim() || null,
        coverage_amount: formData.coverageAmount.trim() || null,
        has_workers_comp: formData.hasWorkersComp,
        workers_comp_carrier: formData.workersCompCarrier.trim() || null,
        certifications: formData.certifications,
        other_certification: formData.otherCertification.trim() || null,

        service_types: formData.serviceTypes,
        service_area_zips: formData.serviceAreaZips.trim(),
        max_project_size: formData.maxProjectSize,
        projects_per_month: formData.projectsPerMonth,
        offers_estimates: formData.offersEstimates,
        offers_warranty: formData.offersWarranty,
        warranty_length: formData.warrantyLength.trim() || null,

        price_1br_full: formData.price1BRFull,
        price_3br_walls: formData.price3BRWalls,
        price_3br_trim_doors: formData.price3BRTrimDoors,
        price_3br_ceilings: formData.price3BRCeilings,
        price_5br_full: formData.price5BRFull,
        price_5br_cabinets: formData.price5BRCabinets,
      });

      if (error) throw error;
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // ---- render helpers ----

  // Format a number as $1,234,567
  const formatCurrencyDisplay = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined || val === '') return '';
    const num = typeof val === 'string' ? Number(val.replace(/[^0-9]/g, '')) : val;
    if (isNaN(num) || num === 0) return '';
    return '$' + num.toLocaleString('en-US');
  };

  // Strip formatting to get raw number
  const parseCurrencyInput = (raw: string): string => {
    return raw.replace(/[^0-9]/g, '');
  };

  const renderInput = (
    key: keyof PainterFormData,
    label: string,
    opts?: {
      type?: string;
      placeholder?: string;
      required?: boolean;
      helper?: string;
      currency?: boolean;
    },
  ) => {
    const { type = 'text', placeholder = '', required = false, helper, currency = false } = opts || {};
    const value = formData[key];

    let displayValue: string;
    if (currency) {
      displayValue = formatCurrencyDisplay(value as string | number | null | undefined);
    } else {
      displayValue = value === null || value === undefined ? '' : String(value);
    }

    return (
      <div style={styles.formGroup}>
        <label style={styles.label}>
          {label}
          {required && <span style={styles.requiredStar}>*</span>}
        </label>
        <input
          type={currency ? 'text' : type}
          inputMode={currency || type === 'number' ? 'numeric' : undefined}
          placeholder={placeholder}
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value;
            if (currency) {
              const digits = parseCurrencyInput(raw);
              if (type === 'number' || typeof value === 'number' || value === null) {
                updateField(key, digits === '' ? null : (Number(digits) as never));
              } else {
                updateField(key, digits === '' ? ('' as never) : (digits as never));
              }
            } else if (type === 'number') {
              updateField(key, raw === '' ? null : (Number(raw) as never));
            } else {
              updateField(key, raw as never);
            }
          }}
          style={{
            ...styles.input,
            ...(errors[key] ? styles.inputError : {}),
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#74b9ff';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = errors[key] ? '#e74c3c' : '#ddd';
          }}
        />
        {helper && <p style={styles.helperText}>{helper}</p>}
        {errors[key] && <p style={styles.errorText}>{errors[key]}</p>}
      </div>
    );
  };

  const renderToggle = (
    key: keyof PainterFormData,
    label: string,
  ) => (
    <div style={styles.toggleRow}>
      <span style={styles.toggleLabel}>{label}</span>
      <button
        type="button"
        style={styles.toggleButton(formData[key] === true)}
        onClick={() => updateField(key, true as never)}
      >
        Yes
      </button>
      <button
        type="button"
        style={styles.toggleButton(formData[key] === false)}
        onClick={() => updateField(key, false as never)}
      >
        No
      </button>
    </div>
  );

  // =========================================================================
  // Step Renderers
  // =========================================================================

  const renderStep1 = () => (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Company Information</h3>

      <div style={styles.grid2}>
        {renderInput('companyName', 'Company Name', {
          required: true,
          placeholder: 'Your painting company name',
        })}
        {renderInput('ownerName', 'Owner / Primary Contact', {
          required: true,
          placeholder: 'Full name',
        })}
      </div>

      <div style={styles.grid2}>
        {renderInput('email', 'Email', {
          type: 'email',
          required: true,
          placeholder: 'you@company.com',
        })}
        {renderInput('phone', 'Phone', {
          type: 'tel',
          required: true,
          placeholder: '(555) 123-4567',
        })}
      </div>

      {renderInput('streetAddress', 'Street Address', {
        required: true,
        placeholder: '123 Main Street',
      })}

      <div style={styles.grid2}>
        {renderInput('city', 'City', { required: true, placeholder: 'City' })}
        <div style={styles.formGroup}>
          <label style={styles.label}>
            State<span style={styles.requiredStar}>*</span>
          </label>
          <select
            value={formData.state}
            onChange={(e) => updateField('state', e.target.value)}
            style={{
              ...styles.select,
              ...(errors.state ? styles.inputError : {}),
            }}
          >
            <option value="">Select state...</option>
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          {errors.state && <p style={styles.errorText}>{errors.state}</p>}
        </div>
      </div>

      <div style={styles.grid2}>
        {renderInput('zipCode', 'ZIP Code', {
          required: true,
          placeholder: '92101',
        })}
        {renderInput('website', 'Website', {
          placeholder: 'https://yoursite.com',
        })}
      </div>

      <div style={styles.grid2}>
        {renderInput('yearsInBusiness', 'Years in Business', {
          type: 'number',
          required: true,
          placeholder: '0',
        })}
        {renderInput('crewSize', 'Number of Employees / Crew Size', {
          type: 'number',
          required: true,
          placeholder: '1',
        })}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Licensing &amp; Credentials</h3>

      {/* Contractor License */}
      {renderToggle('hasLicense', "Do you have a contractor's license?")}
      {formData.hasLicense && (
        <div
          style={{
            background: '#f9f9f9',
            padding: '16px',
            marginBottom: '18px',
            borderLeft: '3px solid #74b9ff',
          }}
        >
          <div style={styles.grid2}>
            {renderInput('licenseNumber', 'License Number', {
              required: true,
              placeholder: 'e.g. 1019026',
            })}
            <div style={styles.formGroup}>
              <label style={styles.label}>
                License State<span style={styles.requiredStar}>*</span>
              </label>
              <select
                value={formData.licenseState}
                onChange={(e) => updateField('licenseState', e.target.value)}
                style={{
                  ...styles.select,
                  ...(errors.licenseState ? styles.inputError : {}),
                }}
              >
                <option value="">Select state...</option>
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              {errors.licenseState && (
                <p style={styles.errorText}>{errors.licenseState}</p>
              )}
            </div>
          </div>
          {renderInput('licenseExpiration', 'License Expiration Date', {
            type: 'date',
            required: true,
          })}
        </div>
      )}

      {/* Bonding */}
      {renderToggle('isBonded', 'Are you bonded?')}
      {formData.isBonded && (
        <div
          style={{
            background: '#f9f9f9',
            padding: '16px',
            marginBottom: '18px',
            borderLeft: '3px solid #74b9ff',
          }}
        >
          <div style={styles.grid2}>
            {renderInput('bondingCompany', 'Bonding Company', {
              required: true,
              placeholder: 'Company name',
            })}
            {renderInput('bondAmount', 'Bond Amount', {
              required: true,
              placeholder: '$25,000',
              currency: true,
            })}
          </div>
        </div>
      )}

      {/* Insurance */}
      {renderToggle('isInsured', 'Are you insured?')}
      {formData.isInsured && (
        <div
          style={{
            background: '#f9f9f9',
            padding: '16px',
            marginBottom: '18px',
            borderLeft: '3px solid #74b9ff',
          }}
        >
          <div style={styles.grid2}>
            {renderInput('insuranceCompany', 'Insurance Company', {
              required: true,
              placeholder: 'Company name',
            })}
            {renderInput('policyNumber', 'Policy Number', {
              required: true,
              placeholder: 'Policy #',
            })}
          </div>
          {renderInput('coverageAmount', 'General Liability Coverage Amount', {
            currency: true,
            required: true,
            placeholder: '$1,000,000',
          })}
        </div>
      )}

      {/* Workers Comp */}
      {renderToggle('hasWorkersComp', 'Do you carry workers compensation?')}
      {formData.hasWorkersComp && (
        <div
          style={{
            background: '#f9f9f9',
            padding: '16px',
            marginBottom: '18px',
            borderLeft: '3px solid #74b9ff',
          }}
        >
          {renderInput('workersCompCarrier', 'Workers Comp Carrier', {
            required: true,
            placeholder: 'Carrier name',
          })}
        </div>
      )}

      {/* Certifications */}
      <div style={{ marginTop: '20px' }}>
        <label style={styles.label}>Certifications</label>
        {CERTIFICATION_OPTIONS.map((cert) => (
          <label key={cert} style={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={formData.certifications.includes(cert)}
              onChange={() => toggleArrayItem('certifications', cert)}
              style={{ accentColor: '#74b9ff', width: '16px', height: '16px' }}
            />
            <span style={styles.checkboxLabel}>{cert}</span>
          </label>
        ))}
        {formData.certifications.includes('Other') && (
          <div style={{ marginTop: '8px', marginLeft: '24px' }}>
            {renderInput('otherCertification', 'Specify Other Certification', {
              placeholder: 'Certification name',
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Services &amp; Coverage</h3>

      {/* Service types */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Service Types<span style={styles.requiredStar}>*</span>
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '4px 16px',
          }}
        >
          {SERVICE_TYPE_OPTIONS.map((svc) => (
            <label key={svc} style={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={formData.serviceTypes.includes(svc)}
                onChange={() => toggleArrayItem('serviceTypes', svc)}
                style={{ accentColor: '#74b9ff', width: '16px', height: '16px' }}
              />
              <span style={styles.checkboxLabel}>{svc}</span>
            </label>
          ))}
        </div>
        {errors.serviceTypes && (
          <p style={styles.errorText}>{errors.serviceTypes}</p>
        )}
      </div>

      {/* Service area */}
      {renderInput('serviceAreaZips', 'Service Area ZIP Codes', {
        required: true,
        placeholder: '92101, 92102, 92103...',
        helper:
          'Enter a comma-separated list of ZIP codes you serve, or a radius description (e.g. "25 miles from 92101").',
      })}

      {/* Max project size */}
      <div style={styles.formGroup}>
        <label style={styles.label}>
          Maximum Project Size<span style={styles.requiredStar}>*</span>
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {PROJECT_SIZE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => updateField('maxProjectSize', opt.value)}
              style={{
                padding: '10px 16px',
                fontSize: '0.85rem',
                fontWeight: 500,
                border:
                  formData.maxProjectSize === opt.value
                    ? '1px solid #74b9ff'
                    : '1px solid #ccc',
                background:
                  formData.maxProjectSize === opt.value ? '#74b9ff' : '#fff',
                color:
                  formData.maxProjectSize === opt.value ? '#000' : '#555',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: 'inherit',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {errors.maxProjectSize && (
          <p style={styles.errorText}>{errors.maxProjectSize}</p>
        )}
      </div>

      {/* Projects per month */}
      {renderInput('projectsPerMonth', 'Average Projects Completed per Month', {
        type: 'number',
        required: true,
        placeholder: '4',
      })}

      {/* Estimates & warranty */}
      {renderToggle('offersEstimates', 'Does your company provide your own written contract?')}
      {renderToggle('offersWarranty', 'Do you offer warranties, or touch-up/call-back provisions?')}
      {formData.offersWarranty && (
        <div style={{ marginLeft: '24px' }}>
          {renderInput('warrantyLength', 'Warranty Length', {
            required: true,
            placeholder: 'e.g. 2 years',
          })}
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div style={styles.card}>
      <h3 style={styles.cardTitle}>Pricing Baseline</h3>
      <p
        style={{
          fontSize: '0.88rem',
          color: '#666',
          lineHeight: 1.7,
          marginBottom: '24px',
        }}
      >
        To help us match you with the right customers, please provide your
        typical pricing for the following standard projects. These prices help us
        estimate what you'd charge for various project types.
      </p>

      {PRICING_SCENARIOS.map((scenario) => {
        const value = formData[scenario.key];
        return (
          <div
            key={scenario.key}
            style={{
              marginBottom: '24px',
              paddingBottom: '24px',
              borderBottom: '1px solid #eee',
            }}
          >
            <label style={{ ...styles.label, color: '#ccc', fontSize: '0.9rem' }}>
              {scenario.label}
            </label>
            <p style={{ ...styles.helperText, color: '#555', marginBottom: '8px' }}>
              {scenario.description}
            </p>
            <div style={{ maxWidth: '220px' }}>
              <input
                type="text"
                inputMode="numeric"
                placeholder="$0"
                value={formatCurrencyDisplay(value)}
                onChange={(e) => {
                  const digits = parseCurrencyInput(e.target.value);
                  updateField(
                    scenario.key,
                    digits === '' ? null : Number(digits),
                  );
                }}
                style={{
                  ...styles.input,
                  maxWidth: '220px',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#74b9ff';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = '#ddd';
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  // =========================================================================
  // Main render
  // =========================================================================

  if (submitted) {
    return (
      <div className="bg-[#1a1a1a] text-white" style={{ minHeight: '100vh' }}>
        {/* Hero */}
        <section className="bg-[#111] text-white py-16 border-b border-[#333]">
          <div className="container-custom text-center">
            <h1
              className="text-3xl md:text-4xl font-bold mb-3"
              style={{ fontFamily: "'Cabin', sans-serif" }}
            >
              Join Our Network
            </h1>
            <p className="text-gray-400">Partner with The Painted Painter</p>
          </div>
        </section>

        <section style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              background: '#1a3a1a',
              border: '2px solid #2d6b2d',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#4caf50',
              fontSize: '2rem',
              fontWeight: 700,
            }}
          >
            &#10003;
          </div>
          <h2
            style={{
              fontFamily: "'Cabin', sans-serif",
              fontSize: '1.6rem',
              marginBottom: '12px',
            }}
          >
            Application Submitted!
          </h2>
          <p
            style={{
              color: '#bbb',
              fontSize: '0.95rem',
              maxWidth: '500px',
              margin: '0 auto 28px',
              lineHeight: 1.7,
            }}
          >
            Thank you for applying to join The Painted Painter network. We will
            review your information and reach out within 2-3 business days.
          </p>
          <a href="/" className="cta-button">
            Back to Home
          </a>
        </section>
      </div>
    );
  }

  return (
    <div className="bg-[#1a1a1a] text-white" style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <section className="bg-[#111] text-white py-16 border-b border-[#333]">
        <div className="container-custom text-center">
          <h1
            className="text-3xl md:text-4xl font-bold mb-3"
            style={{ fontFamily: "'Cabin', sans-serif" }}
          >
            Join Our Network
          </h1>
          <p className="text-gray-400">Partner with The Painted Painter</p>
        </div>
      </section>

      {/* Step Indicator */}
      <section style={{ background: '#1e2120', padding: '24px 20px 0' }}>
        <div
          style={{
            maxWidth: '700px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'center',
            gap: '0',
          }}
        >
          {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = stepNum === currentStep;
            const isCompleted = stepNum < currentStep;
            return (
              <div
                key={stepNum}
                style={{
                  flex: 1,
                  textAlign: 'center',
                  position: 'relative',
                }}
              >
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: 0,
                      right: '50%',
                      height: '2px',
                      background: isCompleted || isActive ? '#74b9ff' : '#444',
                      zIndex: 0,
                    }}
                  />
                )}
                {idx < STEP_LABELS.length - 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '16px',
                      left: '50%',
                      right: 0,
                      height: '2px',
                      background: isCompleted ? '#74b9ff' : '#444',
                      zIndex: 0,
                    }}
                  />
                )}

                {/* Circle */}
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: isActive
                      ? '#74b9ff'
                      : isCompleted
                        ? '#74b9ff'
                        : '#333',
                    color: isActive || isCompleted ? '#000' : '#888',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    position: 'relative',
                    zIndex: 1,
                    transition: 'all 0.3s',
                  }}
                >
                  {isCompleted ? '\u2713' : stepNum}
                </div>
                {/* Label */}
                <p
                  style={{
                    fontSize: '0.72rem',
                    color: isActive ? '#74b9ff' : '#777',
                    marginTop: '6px',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {label}
                </p>
              </div>
            );
          })}
        </div>

        {/* Progress bar */}
        <div
          style={{
            maxWidth: '700px',
            margin: '20px auto 0',
            height: '3px',
            background: '#333',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${((currentStep - 1) / 3) * 100}%`,
              background: '#74b9ff',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </section>

      {/* Form Body */}
      <section style={{ background: '#1e2120', padding: '30px 20px 50px' }}>
        <div
          key={currentStep}
          style={{
            animation: `${slideDirection === 'right' ? 'slideInRight' : 'slideInLeft'} 0.35s ease`,
          }}
        >
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(30px); }
              to { opacity: 1; transform: translateX(0); }
            }
            @keyframes slideInLeft {
              from { opacity: 0; transform: translateX(-30px); }
              to { opacity: 1; transform: translateX(0); }
            }
          `}</style>

          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>

        {/* Navigation buttons */}
        <div
          style={{
            maxWidth: '700px',
            margin: '24px auto 0',
            display: 'flex',
            justifyContent: currentStep === 1 ? 'flex-end' : 'space-between',
            gap: '12px',
          }}
        >
          {currentStep > 1 && (
            <button
              type="button"
              onClick={goPrev}
              className="btn-primary"
              style={{ minWidth: '130px' }}
            >
              &larr; Previous
            </button>
          )}

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={goNext}
              className="btn-secondary"
              style={{ minWidth: '130px' }}
            >
              Next &rarr;
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="btn-secondary"
              style={{
                minWidth: '180px',
                opacity: submitting ? 0.6 : 1,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
        </div>

        {submitError && (
          <p
            style={{
              textAlign: 'center',
              color: '#e74c3c',
              fontSize: '0.85rem',
              marginTop: '16px',
            }}
          >
            {submitError}
          </p>
        )}
      </section>
    </div>
  );
};

export default PainterSignup;
