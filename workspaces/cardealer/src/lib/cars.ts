import carsData from '../../data/cars.json'
import configData from '../../data/config.json'
import type { Car, SiteConfig } from '@/types/car'

export function getCars(): Car[] {
  return carsData as Car[]
}

export function getCar(id: string): Car | undefined {
  return (carsData as Car[]).find((car) => car.id === id)
}

export function getConfig(): SiteConfig {
  return configData as SiteConfig
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatMileage(miles: number): string {
  return `${new Intl.NumberFormat('en-US').format(miles)} mi`
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
