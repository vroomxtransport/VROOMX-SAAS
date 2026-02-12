/**
 * Sample data generation for new trial users.
 * All generated records include '[SAMPLE DATA]' in notes for cleanup identification.
 */

const SAMPLE_TAG = '[SAMPLE DATA]'

interface SampleBroker {
  name: string
  email: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  payment_terms: string
  notes: string
}

interface SampleDriver {
  first_name: string
  last_name: string
  email: string
  phone: string
  city: string
  state: string
  license_number: string
  driver_type: string
  driver_status: string
  pay_type: string
  pay_rate: string
  notes: string
}

interface SampleTruck {
  unit_number: string
  truck_type: string
  truck_status: string
  year: number
  make: string
  model: string
  vin: string
  ownership: string
  notes: string
}

interface SampleOrder {
  vehicle_vin: string
  vehicle_year: number
  vehicle_make: string
  vehicle_model: string
  vehicle_type: string
  vehicle_color: string
  pickup_location: string
  pickup_city: string
  pickup_state: string
  pickup_zip: string
  pickup_contact_name: string
  pickup_contact_phone: string
  pickup_date: string
  delivery_location: string
  delivery_city: string
  delivery_state: string
  delivery_zip: string
  delivery_contact_name: string
  delivery_contact_phone: string
  delivery_date: string
  revenue: string
  carrier_pay: string
  broker_fee: string
  payment_type: string
  notes: string
}

export interface SampleData {
  brokers: SampleBroker[]
  drivers: SampleDriver[]
  trucks: SampleTruck[]
  orders: SampleOrder[]
}

/** Generate a date offset from today in ISO format */
function dateOffset(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function generateSampleData(): SampleData {
  const brokers: SampleBroker[] = [
    {
      name: 'United Auto Transport',
      email: 'dispatch@unitedautotransport.com',
      phone: '(305) 555-0142',
      address: '2100 NW 42nd Ave',
      city: 'Miami',
      state: 'FL',
      zip: '33126',
      payment_terms: 'NET30',
      notes: SAMPLE_TAG,
    },
    {
      name: 'Pacific Coast Logistics',
      email: 'orders@pacificcoastlog.com',
      phone: '(213) 555-0198',
      address: '850 S Figueroa St',
      city: 'Los Angeles',
      state: 'CA',
      zip: '90017',
      payment_terms: 'NET15',
      notes: SAMPLE_TAG,
    },
  ]

  const drivers: SampleDriver[] = [
    {
      first_name: 'Marcus',
      last_name: 'Johnson',
      email: 'marcus.j@example.com',
      phone: '(404) 555-0173',
      city: 'Atlanta',
      state: 'GA',
      license_number: 'CDL-GA-482910',
      driver_type: 'company',
      driver_status: 'active',
      pay_type: 'percentage_of_carrier_pay',
      pay_rate: '30',
      notes: SAMPLE_TAG,
    },
    {
      first_name: 'David',
      last_name: 'Ramirez',
      email: 'david.r@example.com',
      phone: '(214) 555-0256',
      city: 'Dallas',
      state: 'TX',
      license_number: 'CDL-TX-719384',
      driver_type: 'company',
      driver_status: 'active',
      pay_type: 'per_car',
      pay_rate: '75',
      notes: SAMPLE_TAG,
    },
    {
      first_name: 'James',
      last_name: 'Kowalski',
      email: 'james.k@example.com',
      phone: '(312) 555-0331',
      city: 'Chicago',
      state: 'IL',
      license_number: 'CDL-IL-556201',
      driver_type: 'owner_operator',
      driver_status: 'active',
      pay_type: 'dispatch_fee_percent',
      pay_rate: '10',
      notes: SAMPLE_TAG,
    },
  ]

  const trucks: SampleTruck[] = [
    {
      unit_number: 'T-101',
      truck_type: '7_car',
      truck_status: 'active',
      year: 2022,
      make: 'Peterbilt',
      model: '389',
      vin: '1XPWD49X1ED200001',
      ownership: 'company',
      notes: SAMPLE_TAG,
    },
    {
      unit_number: 'T-102',
      truck_type: '9_car',
      truck_status: 'active',
      year: 2021,
      make: 'Freightliner',
      model: 'Cascadia',
      vin: '3AKJHHDR5LSAA0002',
      ownership: 'company',
      notes: SAMPLE_TAG,
    },
  ]

  const orders: SampleOrder[] = [
    {
      vehicle_vin: '1HGBH41JXMN100001',
      vehicle_year: 2024,
      vehicle_make: 'Honda',
      vehicle_model: 'Civic',
      vehicle_type: 'Sedan',
      vehicle_color: 'Silver',
      pickup_location: '1200 S Pine Island Rd',
      pickup_city: 'Fort Lauderdale',
      pickup_state: 'FL',
      pickup_zip: '33324',
      pickup_contact_name: 'Mike Torres',
      pickup_contact_phone: '(954) 555-0111',
      pickup_date: dateOffset(-5),
      delivery_location: '500 Peachtree St NE',
      delivery_city: 'Atlanta',
      delivery_state: 'GA',
      delivery_zip: '30308',
      delivery_contact_name: 'Sarah Chen',
      delivery_contact_phone: '(404) 555-0222',
      delivery_date: dateOffset(-2),
      revenue: '850',
      carrier_pay: '600',
      broker_fee: '50',
      payment_type: 'COP',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: '5YJ3E1EA8KF300002',
      vehicle_year: 2023,
      vehicle_make: 'Tesla',
      vehicle_model: 'Model 3',
      vehicle_type: 'Sedan',
      vehicle_color: 'White',
      pickup_location: '2200 W Mockingbird Ln',
      pickup_city: 'Dallas',
      pickup_state: 'TX',
      pickup_zip: '75235',
      pickup_contact_name: 'Ryan Patel',
      pickup_contact_phone: '(214) 555-0333',
      pickup_date: dateOffset(-3),
      delivery_location: '700 Louisiana St',
      delivery_city: 'Houston',
      delivery_state: 'TX',
      delivery_zip: '77002',
      delivery_contact_name: 'Aisha Brown',
      delivery_contact_phone: '(713) 555-0444',
      delivery_date: dateOffset(-1),
      revenue: '450',
      carrier_pay: '300',
      broker_fee: '25',
      payment_type: 'COD',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: 'WBAPH5C55BA700003',
      vehicle_year: 2024,
      vehicle_make: 'BMW',
      vehicle_model: 'X5',
      vehicle_type: 'SUV',
      vehicle_color: 'Black',
      pickup_location: '100 N Riverside Plaza',
      pickup_city: 'Chicago',
      pickup_state: 'IL',
      pickup_zip: '60606',
      pickup_contact_name: 'Tom Williams',
      pickup_contact_phone: '(312) 555-0555',
      pickup_date: dateOffset(0),
      delivery_location: '300 E Pratt St',
      delivery_city: 'Baltimore',
      delivery_state: 'MD',
      delivery_zip: '21202',
      delivery_contact_name: 'Lisa Park',
      delivery_contact_phone: '(443) 555-0666',
      delivery_date: dateOffset(3),
      revenue: '1200',
      carrier_pay: '850',
      broker_fee: '75',
      payment_type: 'COP',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: '1G1YY22G965100004',
      vehicle_year: 2023,
      vehicle_make: 'Chevrolet',
      vehicle_model: 'Corvette',
      vehicle_type: 'Coupe',
      vehicle_color: 'Red',
      pickup_location: '8000 Beverly Blvd',
      pickup_city: 'Los Angeles',
      pickup_state: 'CA',
      pickup_zip: '90048',
      pickup_contact_name: 'Carlos Reyes',
      pickup_contact_phone: '(323) 555-0777',
      pickup_date: dateOffset(1),
      delivery_location: '100 The Embarcadero',
      delivery_city: 'San Francisco',
      delivery_state: 'CA',
      delivery_zip: '94105',
      delivery_contact_name: 'Emma Liu',
      delivery_contact_phone: '(415) 555-0888',
      delivery_date: dateOffset(3),
      revenue: '900',
      carrier_pay: '650',
      broker_fee: '50',
      payment_type: 'BILL',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: '2T1BU4EE9DC900005',
      vehicle_year: 2024,
      vehicle_make: 'Toyota',
      vehicle_model: 'Camry',
      vehicle_type: 'Sedan',
      vehicle_color: 'Blue',
      pickup_location: '1 MetLife Stadium Dr',
      pickup_city: 'East Rutherford',
      pickup_state: 'NJ',
      pickup_zip: '07073',
      pickup_contact_name: 'Nick Ferraro',
      pickup_contact_phone: '(201) 555-0999',
      pickup_date: dateOffset(2),
      delivery_location: '1500 Sugar Bowl Dr',
      delivery_city: 'New Orleans',
      delivery_state: 'LA',
      delivery_zip: '70112',
      delivery_contact_name: 'Denise Washington',
      delivery_contact_phone: '(504) 555-1010',
      delivery_date: dateOffset(6),
      revenue: '1450',
      carrier_pay: '1050',
      broker_fee: '100',
      payment_type: 'COP',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: '3FA6P0G79HR200006',
      vehicle_year: 2023,
      vehicle_make: 'Ford',
      vehicle_model: 'Fusion',
      vehicle_type: 'Sedan',
      vehicle_color: 'Gray',
      pickup_location: '3900 Las Vegas Blvd S',
      pickup_city: 'Las Vegas',
      pickup_state: 'NV',
      pickup_zip: '89119',
      pickup_contact_name: 'Jenny Kim',
      pickup_contact_phone: '(702) 555-1111',
      pickup_date: dateOffset(3),
      delivery_location: '600 E Van Buren St',
      delivery_city: 'Phoenix',
      delivery_state: 'AZ',
      delivery_zip: '85004',
      delivery_contact_name: 'Omar Hassan',
      delivery_contact_phone: '(602) 555-1212',
      delivery_date: dateOffset(5),
      revenue: '550',
      carrier_pay: '400',
      broker_fee: '30',
      payment_type: 'COD',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: 'WDDGF4HB1CR300007',
      vehicle_year: 2024,
      vehicle_make: 'Mercedes-Benz',
      vehicle_model: 'C-Class',
      vehicle_type: 'Sedan',
      vehicle_color: 'White',
      pickup_location: '400 Broad St',
      pickup_city: 'Seattle',
      pickup_state: 'WA',
      pickup_zip: '98109',
      pickup_contact_name: 'Brian O\'Neal',
      pickup_contact_phone: '(206) 555-1313',
      pickup_date: dateOffset(4),
      delivery_location: '750 NW Everett St',
      delivery_city: 'Portland',
      delivery_state: 'OR',
      delivery_zip: '97209',
      delivery_contact_name: 'Rachel Green',
      delivery_contact_phone: '(503) 555-1414',
      delivery_date: dateOffset(6),
      revenue: '650',
      carrier_pay: '475',
      broker_fee: '40',
      payment_type: 'CHECK',
      notes: SAMPLE_TAG,
    },
    {
      vehicle_vin: '1N4AL3AP9DC400008',
      vehicle_year: 2023,
      vehicle_make: 'Nissan',
      vehicle_model: 'Altima',
      vehicle_type: 'Sedan',
      vehicle_color: 'Black',
      pickup_location: '200 E Colfax Ave',
      pickup_city: 'Denver',
      pickup_state: 'CO',
      pickup_zip: '80203',
      pickup_contact_name: 'Steve Martinez',
      pickup_contact_phone: '(720) 555-1515',
      pickup_date: dateOffset(5),
      delivery_location: '1000 Broadway',
      delivery_city: 'Kansas City',
      delivery_state: 'MO',
      delivery_zip: '64105',
      delivery_contact_name: 'Hannah White',
      delivery_contact_phone: '(816) 555-1616',
      delivery_date: dateOffset(8),
      revenue: '750',
      carrier_pay: '525',
      broker_fee: '45',
      payment_type: 'COP',
      notes: SAMPLE_TAG,
    },
  ]

  return { brokers, drivers, trucks, orders }
}
