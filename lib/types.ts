export interface Enterprise {
  id: string
  name: string
  shortName: string
  director: string
  phone: string
  email: string
  address: string
  iban: string
  createdAt: string
  referencePoint: { x: number; y: number }
  logo?: string
  favicon?: string
  banner?: string
  appCover?: string
  tags: string[]
  isActive: boolean

  // Statistics
  totalFieldArea: number
  irrigatedArea: number
  nonIrrigatedArea: number
  fieldsCount: number
  productionPlansCount: number
  avgFieldSize: number
  culturesCount: number

  // Staff
  employeesCount: number
  activeNow: number

  // Equipment
  machinesCount: number
  unitsCount: number
  hasWeatherStation: boolean

  // Financial
  expectedGrossYield: number
  expectedGrossProfit: number
  profitability: number
  grossYieldCurrentSeason: number
}

export interface MasterCollection {
  id: string
  name: string
}

export interface CreateEnterpriseForm {
  fullName: string
  shortName: string
  director: string
  phone: string
  email: string
  address: string
  createdAt: { day: string; month: string; year: string }
  referencePoint: { x: string; y: string }
  logo?: File
  banner?: File
  isInactive: boolean
  masterCollections: {
    plantProtection: { enabled: boolean; collectionId: string }
    fertilizers: { enabled: boolean; collectionId: string }
    pests: { enabled: boolean; collectionId: string }
    diseases: { enabled: boolean; collectionId: string }
    weeds: { enabled: boolean; collectionId: string }
    cultures: { enabled: boolean; collectionId: string }
    roles: { enabled: boolean; collectionId: string }
  }
}
