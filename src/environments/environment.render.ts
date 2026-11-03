/**
 * Render deployment (`ng build --configuration production,render`). A full copy of
 * environment.ts, since a file replacement cannot import the file it replaces.
 *
 * Every API, media and image-proxy URL is built as `${backendUrl}${apiBaseUrl}…`, so pointing
 * `backendUrl` at the Render backend sends them all there directly — the app can be served as a
 * plain static site, with no proxy in front. That relies on the backend's CORS allowing this
 * site's origin (it allows any origin while `frontendUrl` is unset in its env JSON).
 */
export const environment = {
  production: true,
  environmentName: 'render',
  isLocal: false,
  apiBaseUrl: '/api/v1/cmsVendor',
  backendUrl: 'https://offerappbackend-agrc.onrender.com',
  googleMapsApiKey: 'AIzaSyDEAJeILGkY06tdxNHyTpECAuW_XWMr5nw',
  googlePlacesApiKey: 'AIzaSyC8E09xmn1xqFPoCXGiv20Jtx90yrrKgtU',
  googleMapId: 'DEMO_MAP_ID',
};

