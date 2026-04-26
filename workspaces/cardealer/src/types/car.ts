export interface Car {
  id: string
  make: string
  model: string
  year: number
  price: number
  mileage: number
  color: string
  transmission: 'Manual' | 'Automatic'
  fuelType: 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid'
  description: string
  features: string[]
  images: string[]
  sold: boolean
}

export interface SiteConfig {
  businessName: string
  tagline: string
  phone: string
  email: string
  whatsapp: string
  location: string
}
