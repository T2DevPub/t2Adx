import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { prisma } from './prisma';

const BASE = 'https://dashboard.gamob.com/api';
const CURRENCY = (process.env.GAMOB_REPORT_CURRENCY || 'USD').toUpperCase();
// These values are taken from the GAMOB API explorer's generated request URL.
const METRICS = [
  'REVENUE', 'AD_REQUEST', 'IMPRESSION', 'CLICK', 'MATCHED_REQUEST',
  'MATCH_RATE', 'SHOW_RATE', 'ECPM', 'CTR', 'CPC',
] as const;
const DIMENSIONS = {
  daily: 'DATE,APP_ID,APP_NAME,APP_PACKAGE_NAME',
  country: 'DATE,APP_ID,COUNTRY_NAME,COUNTRY_CODE',
  ad: 'DATE,APP_ID,AD_NAME,AD_ID,AD_UNIT_ID,DEMAND_CHANNEL',
  demand: 'DATE,APP_ID,DEMAND_CHANNEL',
};

export function gamobConfigurationStatus() {
  const required = ['GAMOB_EMAIL', 'GAMOB_PASSWORD', 'GAMOB_API_KEY', 'AUTH_SECRET'];
  const missing = required.filter(k => !process.env[k]);
  return {
    configured: missing.length === 0,
    missing,
    provider: 'GAMOB',
    reportsEndpoint: `${BASE}/reports`,
    appsEndpoint: `${BASE}/apps`,
    adUnitsEndpoint: `${BASE}/ad-units`,
    syncIntervalMinutes: Math.max(5, Math.min(60, Number(process.env.GAMOB_SYNC_INTERVAL_MINUTES || 15))),
    reportCurrency: CURRENCY,
  };
}

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET must be at least 32 characters.');
  return createHash('sha256').update(secret).digest();
}
function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}
function decrypt(value: string) {
  const [iv, tag, data] = value.split('.');
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; token_type?: string };
function safeMessage(body: any) {
  return String(body?.message || body?.error || 'Provider returned an error').slice(0, 300);
}
async function postWithQuery(path: string, params: Record<string, string>) {
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(Number(process.env.GAMOB_TIMEOUT_MS || 30000)),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GAMOB ${path} failed (${response.status}): ${safeMessage(body)}`);
  return body as TokenResponse;
}
async function saveTokens(tokens: TokenResponse, oldRefresh?: string) {
  if (!tokens.access_token) throw new Error('GAMOB authentication response did not include access_token.');
  const refresh = tokens.refresh_token || oldRefresh;
  if (!refresh) throw new Error('GAMOB authentication response did not include refresh_token.');
  const expiresAt = new Date(Date.now() + Math.max(60, Number(tokens.expires_in || 604800)) * 1000);
  await prisma.gamobCredential.upsert({
    where: { id: 'primary' },
    create: { id: 'primary', accessTokenEncrypted: encrypt(tokens.access_token), refreshTokenEncrypted: encrypt(refresh), expiresAt },
    update: { accessTokenEncrypted: encrypt(tokens.access_token), refreshTokenEncrypted: encrypt(refresh), expiresAt },
  });
  return tokens.access_token;
}
async function login() {
  const { GAMOB_EMAIL, GAMOB_PASSWORD, GAMOB_API_KEY } = process.env;
  if (!GAMOB_EMAIL || !GAMOB_PASSWORD || !GAMOB_API_KEY) {
    throw new Error('Set GAMOB_EMAIL, GAMOB_PASSWORD and GAMOB_API_KEY in Coolify.');
  }
  const result = await postWithQuery('/auth/login', { email: GAMOB_EMAIL, password: GAMOB_PASSWORD, token: GAMOB_API_KEY });
  return saveTokens(result);
}
async function getAccessToken(forceRefresh = false): Promise<string> {
  const stored = await prisma.gamobCredential.findUnique({ where: { id: 'primary' } });
  if (!stored) return login();
  if (!forceRefresh && stored.expiresAt.getTime() > Date.now() + 5 * 60 * 1000) return decrypt(stored.accessTokenEncrypted);
  const refreshToken = decrypt(stored.refreshTokenEncrypted);
  try {
    const result = await postWithQuery('/auth/refresh', { refresh_token: refreshToken });
    return saveTokens(result, refreshToken);
  } catch {
    return login();
  }
}
async function gamobGet(path: string, params: Record<string, string> = {}, retry = true): Promise<any> {
  const accessToken = await getAccessToken();
  const url = new URL(`${BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const response = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(Number(process.env.GAMOB_TIMEOUT_MS || 30000)),
  });
  if (response.status === 401 && retry) {
    await getAccessToken(true);
    return gamobGet(path, params, false);
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`GAMOB ${path} failed (${response.status}): ${safeMessage(body)}`);
  return body;
}
function rowsFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
}
function dateOnly(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const v = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
function parseDate(value: string) { return new Date(`${value}T00:00:00.000Z`); }
function metricValue(row: any, key: string) {
  const value = row[key];
  return value === undefined || value === null ? '0' : String(value);
}
async function fetchReportPages(params: Record<string, string>) {
  const all: any[] = [];
  let page = 1;
  let lastPage = 1;
  do {
    const body = await gamobGet('/reports', { ...params, page: String(page) });
    all.push(...rowsFrom(body));
    lastPage = Math.max(1, Number(body?.last_page || 1));
    page++;
    if (!rowsFrom(body).length) break;
  } while (page <= lastPage && page <= 100);
  return all;
}
async function upsertReportRows(applicationId: string, type: 'daily' | 'country' | 'ad' | 'demand', rows: any[]) {
  let count = 0;
  for (const row of rows) {
    const dateString = String(row.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) continue;
    const date = parseDate(dateString);
    const impressions = BigInt(row.impression || 0);
    const requests = BigInt(row.ad_request || 0);
    const clicks = BigInt(row.click || 0);
    const matched = BigInt(row.matched_request || 0);
    if (type === 'daily') {
      await prisma.revenueDaily.upsert({
        where: { applicationId_date_currency: { applicationId, date, currency: CURRENCY } },
        create: { applicationId, date, amount: metricValue(row, 'revenue'), currency: CURRENCY, rawPayload: row },
        update: { amount: metricValue(row, 'revenue'), rawPayload: row },
      });
      await prisma.adMetricDaily.upsert({
        where: { applicationId_date: { applicationId, date } },
        create: {
          applicationId, date, impressions, requests, clicks, matchedRequests: matched,
          ecpm: metricValue(row, 'ecpm'), fillRate: metricValue(row, 'match_rate'),
          ctr: metricValue(row, 'ctr'), showRate: metricValue(row, 'show_rate'),
          cpc: metricValue(row, 'cpc'), rawPayload: row,
        },
        update: {
          impressions, requests, clicks, matchedRequests: matched,
          ecpm: metricValue(row, 'ecpm'), fillRate: metricValue(row, 'match_rate'),
          ctr: metricValue(row, 'ctr'), showRate: metricValue(row, 'show_rate'),
          cpc: metricValue(row, 'cpc'), rawPayload: row,
        },
      });
    } else if (type === 'country') {
      const code = String(row.country_code || 'N/A');
      await prisma.countryMetric.upsert({
        where: { applicationId_date_countryCode_currency: { applicationId, date, countryCode: code, currency: CURRENCY } },
        create: {
          applicationId, date, countryCode: code, countryName: String(row.country_name || code),
          revenue: metricValue(row, 'revenue'), currency: CURRENCY, impressions, clicks,
          ecpm: metricValue(row, 'ecpm'), rawPayload: row,
        },
        update: {
          countryName: String(row.country_name || code), revenue: metricValue(row, 'revenue'),
          impressions, clicks, ecpm: metricValue(row, 'ecpm'), rawPayload: row,
        },
      });
    } else {
      const ad = type === 'ad';
      const key = ad
        ? `${String(row.ad_id ?? row.ad_unit_id ?? row.ad_name ?? 'unknown')}:${String(row.demand_channel || 'all')}`
        : String(row.demand_channel ?? 'unknown');
      const label = ad ? String(row.ad_name || row.ad_unit_id || key) : String(row.demand_channel || key);
      const dimensions = ad
        ? { ad_id: row.ad_id, ad_name: row.ad_name, ad_unit_id: row.ad_unit_id, app_id: row.app_id, demand_channel: row.demand_channel }
        : { demand_channel: row.demand_channel, app_id: row.app_id };
      const metrics = Object.fromEntries([
        ['revenue', row.revenue], ['ad_request', row.ad_request], ['impression', row.impression],
        ['click', row.click], ['matched_request', row.matched_request], ['match_rate', row.match_rate],
        ['show_rate', row.show_rate], ['ecpm', row.ecpm], ['ctr', row.ctr], ['cpc', row.cpc],
      ].map(([k, v]) => [k, v == null ? '0' : String(v)]));
      await prisma.gamobBreakdown.upsert({
        where: { applicationId_date_breakdownType_breakdownKey: { applicationId, date, breakdownType: type, breakdownKey: key } },
        create: { applicationId, date, breakdownType: type, breakdownKey: key, label, dimensions, metrics },
        update: { label, dimensions, metrics },
      });
    }
    count++;
  }
  return count;
}

async function syncRange(applicationId: string, startDate: string, endDate: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app?.gamobAppId) throw new Error(`No GAMOB application ID is mapped for ${app?.packageName || applicationId}.`);
  const base = { startDate, endDate, limit: '100000', APP_ID: String(app.gamobAppId), metrics: METRICS.join(',') };
  let fetched = 0;
  for (const [type, dimensions] of Object.entries(DIMENSIONS) as [keyof typeof DIMENSIONS, string][]) {
    const rows = await fetchReportPages({ ...base, dimensions });
    fetched += await upsertReportRows(applicationId, type, rows);
  }
  return fetched;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}
function addMonths(date: Date, months: number) {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
export async function syncApplication(applicationId: string, fullHistory = false) {
  const app = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!app) throw new Error('Application not found.');
  if (!app.gamobAppId) {
    await importGamobApplications();
  }
  const refreshed = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!refreshed?.gamobAppId) throw new Error(`No GAMOB app ID is mapped for ${app.packageName}.`);
  await getAccessToken();
  const end = new Date();
  const endDate = dateOnly(end);
  let fetched = 0;
  let firstDate: string;
  if (!fullHistory) {
    const start = addDays(new Date(`${endDate}T00:00:00Z`), -6);
    firstDate = dateOnly(start);
    fetched += await syncRange(applicationId, firstDate, endDate);
  } else {
    const months = Math.max(3, Math.min(36, Number(process.env.GAMOB_INITIAL_HISTORY_MONTHS || 12)));
    const endUtc = new Date(`${endDate}T00:00:00Z`);
    let cursor = addMonths(endUtc, -months);
    firstDate = dateOnly(cursor);
    // GAMOB rejects ranges longer than three months. Use consecutive 90-day windows.
    while (cursor < endUtc) {
      const chunkEnd = new Date(Math.min(addDays(cursor, 89).getTime(), endUtc.getTime()));
      const from = dateOnly(cursor);
      const to = dateOnly(chunkEnd);
      fetched += await syncRange(applicationId, from, to);
      cursor = addDays(chunkEnd, 1);
    }
  }
  await prisma.application.update({ where: { id: applicationId }, data: { updatedAt: new Date() } });
  return { recordsFetched: fetched, startDate: firstDate, endDate, app: app.name };
}

export async function importGamobApplications() {
  const payload = await gamobGet('/apps');
  const remoteApps = rowsFrom(payload);
  let imported = 0;
  for (const item of remoteApps) {
    const packageName = String(item.app_package_name || '').trim();
    const gamobAppId = String(item.app_id ?? '').trim();
    if (!packageName || !gamobAppId) continue;
    await prisma.application.upsert({
      where: { packageName },
      create: {
        name: String(item.app_name || packageName), packageName, gamobAppId,
        appOs: String(item.app_os || ''), appStatus: String(item.app_status || ''),
        currency: CURRENCY, timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata', enabled: true,
      },
      update: {
        name: String(item.app_name || packageName), gamobAppId,
        appOs: String(item.app_os || ''), appStatus: String(item.app_status || ''),
      },
    });
    imported++;
  }
  return { imported, remoteCount: remoteApps.length };
}

export async function importGamobAdUnits() {
  const payload = await gamobGet('/ad-units');
  const units = rowsFrom(payload);
  let imported = 0;
  for (const unit of units) {
    const appId = String(unit.app?.app_id ?? '').trim();
    const gamobAdId = String(unit.ad_id ?? '').trim();
    if (!appId || !gamobAdId) continue;
    const app = await prisma.application.findUnique({ where: { packageName: String(unit.app?.app_package_name || '') } });
    if (!app) continue;
    await prisma.adUnit.upsert({
      where: { gamobAdId },
      create: {
        gamobAdId, adName: String(unit.ad_name || gamobAdId),
        adUnitId: unit.ad_unit_id ? String(unit.ad_unit_id) : null,
        adSize: unit.ad_size ? String(unit.ad_size) : null,
        adStatus: unit.ad_status ? String(unit.ad_status) : null,
        applicationId: app.id, rawPayload: unit,
      },
      update: {
        adName: String(unit.ad_name || gamobAdId),
        adUnitId: unit.ad_unit_id ? String(unit.ad_unit_id) : null,
        adSize: unit.ad_size ? String(unit.ad_size) : null,
        adStatus: unit.ad_status ? String(unit.ad_status) : null,
        applicationId: app.id, rawPayload: unit,
      },
    });
    imported++;
  }
  return { imported, remoteCount: units.length };
}

export async function connectGamob() {
  await login();
  const apps = await importGamobApplications();
  const adUnits = await importGamobAdUnits();
  return { ...apps, adUnitsImported: adUnits.imported, adUnitsRemoteCount: adUnits.remoteCount };
}

export async function logoutGamob() {
  const stored = await prisma.gamobCredential.findUnique({ where: { id: 'primary' } });
  if (stored) {
    try {
      const token = decrypt(stored.accessTokenEncrypted);
      const url = new URL(`${BASE}/auth/logout`);
      url.searchParams.set('token', token);
      await fetch(url, { method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000) });
    } catch { /* local token deletion still proceeds */ }
    await prisma.gamobCredential.delete({ where: { id: 'primary' } });
  }
}
