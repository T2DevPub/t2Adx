# GAMOB API integration

The authenticated guide has now been supplied and the connector is implemented in `src/lib/gamob.ts`.

Verified report endpoint: `GET https://dashboard.gamob.com/api/reports`.

The adapter uses GAMOB's documented response field names, including `ad_request` (singular), and requests `AD_REQUEST` as shown in the API explorer's generated URL. It handles `last_page` pagination, three-month maximum query windows, app/country/ad/demand groupings, and encrypted access/refresh token persistence.

The API response does not contain a currency field. Set `GAMOB_REPORT_CURRENCY` to the currency used by the GAMOB account. Revenue is never reduced by an additional 20%.
