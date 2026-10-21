import { getJson } from './remote'
import type { WeatherLocation } from '@/data/types'

// Quelle: Open-Meteo (https://open-meteo.com) – kostenlos, ohne API-Schlüssel, CORS-fähig.
// Lizenz CC BY 4.0, Nutzung für nicht-kommerzielle Zwecke frei.

export interface Weather {
  current: { temp: number; feels: number; code: number; wind: number; isDay: boolean; precipitation: number }
  hourly: { time: string; temp: number; code: number; pop: number }[]
  daily: { date: string; code: number; max: number; min: number; pop: number; sunrise: string; sunset: string }[]
}

interface OMResponse {
  current: { temperature_2m: number; apparent_temperature: number; weather_code: number; wind_speed_10m: number; is_day: number; precipitation: number }
  hourly: { time: string[]; temperature_2m: number[]; weather_code: number[]; precipitation_probability: number[] }
  daily: { time: string[]; weather_code: number[]; temperature_2m_max: number[]; temperature_2m_min: number[]; precipitation_probability_max: number[]; sunrise: string[]; sunset: string[] }
}

export async function fetchWeather(loc: WeatherLocation): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    current: 'temperature_2m,apparent_temperature,weather_code,wind_speed_10m,is_day,precipitation',
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
    timezone: 'auto',
    forecast_days: '7',
  })
  const r = await getJson<OMResponse>(`https://api.open-meteo.com/v1/forecast?${params}`)
  const nowHour = new Date().toISOString().slice(0, 13)
  const startIdx = Math.max(0, r.hourly.time.findIndex((t) => new Date(t).toISOString().slice(0, 13) >= nowHour))
  return {
    current: {
      temp: r.current.temperature_2m,
      feels: r.current.apparent_temperature,
      code: r.current.weather_code,
      wind: r.current.wind_speed_10m,
      isDay: r.current.is_day === 1,
      precipitation: r.current.precipitation,
    },
    hourly: r.hourly.time.slice(startIdx, startIdx + 12).map((time, i) => ({
      time,
      temp: r.hourly.temperature_2m[startIdx + i],
      code: r.hourly.weather_code[startIdx + i],
      pop: r.hourly.precipitation_probability[startIdx + i] ?? 0,
    })),
    daily: r.daily.time.map((date, i) => ({
      date,
      code: r.daily.weather_code[i],
      max: r.daily.temperature_2m_max[i],
      min: r.daily.temperature_2m_min[i],
      pop: r.daily.precipitation_probability_max[i] ?? 0,
      sunrise: r.daily.sunrise[i],
      sunset: r.daily.sunset[i],
    })),
  }
}

export async function searchPlaces(q: string): Promise<WeatherLocation[]> {
  const r = await getJson<{ results?: { name: string; admin1?: string; country?: string; latitude: number; longitude: number }[] }>(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6&language=de&format=json`,
  )
  return (r.results ?? []).map((p) => ({
    name: p.name,
    region: [p.admin1, p.country].filter(Boolean).join(', '),
    lat: p.latitude,
    lon: p.longitude,
  }))
}

// WMO-Wettercodes → deutsche Beschreibung + Symbol
export function weatherInfo(code: number, isDay = true): { label: string; emoji: string } {
  if (code === 0) return { label: 'Klar', emoji: isDay ? '☀️' : '🌙' }
  if (code === 1) return { label: 'Überwiegend klar', emoji: isDay ? '🌤️' : '🌙' }
  if (code === 2) return { label: 'Teils bewölkt', emoji: '⛅' }
  if (code === 3) return { label: 'Bedeckt', emoji: '☁️' }
  if (code === 45 || code === 48) return { label: 'Nebel', emoji: '🌫️' }
  if (code >= 51 && code <= 57) return { label: 'Nieselregen', emoji: '🌦️' }
  if (code >= 61 && code <= 67) return { label: code >= 65 ? 'Starker Regen' : 'Regen', emoji: '🌧️' }
  if (code >= 71 && code <= 77) return { label: 'Schnee', emoji: '🌨️' }
  if (code >= 80 && code <= 82) return { label: 'Regenschauer', emoji: '🌦️' }
  if (code === 85 || code === 86) return { label: 'Schneeschauer', emoji: '🌨️' }
  if (code >= 95) return { label: 'Gewitter', emoji: '⛈️' }
  return { label: 'Unbekannt', emoji: '🌡️' }
}
