/**
 * Live weather for the Home screen, via Open-Meteo (free, no API key).
 *
 * The fallback location comes from VITE_DEFAULT_LAT / VITE_DEFAULT_LON env
 * (set in Cloudflare's dashboard and local .env) so no personal coordinates
 * are hardcoded into source that lives on GitHub.
 */

export type HourPoint = {
  label: string;
  emoji: string;
  temp: number;
};

export type WeatherNow = {
  temperature: number;
  weatherCode: number;
  condition: string;
  high: number;
  low: number;
  hours: HourPoint[];
};

// WMO weather codes -> short human-readable condition (Open-Meteo standard).
// Codes not listed here fall back to "Mixed conditions".
const CONDITIONS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Light drizzle",
  53: "Drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Rain showers",
  81: "Rain showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm",
};

const EMOJI: Record<number, string> = {
  0: "☀️",
  1: "🌤️",
  2: "⛅",
  3: "☁️",
  45: "🌫️",
  48: "🌫️",
  51: "🌦️",
  53: "🌦️",
  55: "🌧️",
  61: "🌦️",
  63: "🌧️",
  65: "🌧️",
  71: "🌨️",
  73: "🌨️",
  75: "❄️",
  77: "🌨️",
  80: "🌦️",
  81: "🌦️",
  82: "🌧️",
  85: "🌨️",
  86: "🌨️",
  95: "⛈️",
  96: "⛈️",
  99: "⛈️",
};

export function weatherEmoji(code: number): string {
  return EMOJI[code] ?? "🌡️";
}

export async function fetchWeather(lat: number, lon: number): Promise<WeatherNow> {
  const url = [
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`,
    "current=temperature_2m,weather_code",
    "hourly=temperature_2m,weather_code",
    "forecast_hours=5",
    "daily=temperature_2m_max,temperature_2m_min",
    "timezone=auto",
    "forecast_days=1",
  ].join("&");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Weather fetch failed: ${res.status}`);
  const data = await res.json();
  const code = data.current.weather_code;
  const { time, temperature_2m: temps, weather_code: codes } = data.hourly;
  const hours: HourPoint[] = time.map((iso: string, i: number) => ({
    label: `${Number(iso.slice(11, 13))}h`,
    emoji: weatherEmoji(codes[i]),
    temp: Math.round(temps[i]),
  }));
  return {
    temperature: Math.round(data.current.temperature_2m),
    weatherCode: code,
    condition: CONDITIONS[code] ?? "Mixed conditions",
    high: Math.round(data.daily.temperature_2m_max[0]),
    low: Math.round(data.daily.temperature_2m_min[0]),
    hours,
  };
}

export function getLocation(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    const fallback = {
      lat: Number(import.meta.env["VITE_DEFAULT_LAT"] ?? 36.8),
      lon: Number(import.meta.env["VITE_DEFAULT_LON"] ?? 10.18),
    };
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return resolve(fallback); // server render / unsupported browser
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(fallback), // permission denied or unavailable -> fallback
      { timeout: 5000 },
    );
  });
}
