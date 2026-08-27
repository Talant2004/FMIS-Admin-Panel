export const KOSTANAY_STATION = {
  name: "Костанай Метеостанция",
  location: "Костанай, Казахстан",
  serial: process.env.FIELDCLIMATE_KOSTANAY_SERIAL ?? "01209B94",
  key1: process.env.FIELDCLIMATE_KOSTANAY_KEY1 ?? "sa1pr",
  key2: process.env.FIELDCLIMATE_KOSTANAY_KEY2 ?? "66kkv",
  fieldClimateUrl: "https://fieldclimate.com",
} as const
