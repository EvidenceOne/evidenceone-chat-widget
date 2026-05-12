// Logo3_Preta.svg inlined — dark version (green + #1d1d1b) for white drawer background.
// No network request, no img src — pure SVG string injected via innerHTML.
//
// LOCKED ASSET. This is the EvidenceOne wordmark used inside the drawer header.
// Its SHA-256 is verified at runtime by src/utils/integrity.ts. The widget
// refuses to authenticate against the EvidenceOne API if this string is
// tampered with at runtime. Do not modify without updating the build-time
// brandIntegrity() hook in stencil.config.ts.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 172.96 205.28" aria-label="EvidenceOne" role="img"><defs><style>.cls-1{fill:#51c878;}.cls-2{fill:#1d1d1b;}</style></defs><g id="Camada_2" data-name="Camada 2"><g id="Camada_1-2" data-name="Camada 1"><path d="M30.76,177.42V27H122.4V44H49.93V93.05h67.52v17H49.93v50.46H123.3v17Z"/><path class="cls-1" d="M173,81.47v99.74H160.44v-88h-.66l-24.1,17.87V97.47l21.69-16Z"/><path class="cls-2" d="M164.52,190.32v5.35a4.11,4.11,0,0,1-4.1,4.1H9.61a4.11,4.11,0,0,1-4.1-4.1V9.61a4.11,4.11,0,0,1,4.1-4.1H160.42a4.11,4.11,0,0,1,4.1,4.1V72.12H170V9.61A9.62,9.62,0,0,0,160.42,0H9.61A9.62,9.62,0,0,0,0,9.61V195.67a9.62,9.62,0,0,0,9.61,9.61H160.42a9.62,9.62,0,0,0,9.6-9.61v-5.35Z"/></g></g></svg>`;

// "E1" boxed mark — used on the inline pill variant against the navy background.
// White box frame + white "E" + green "1". Locked asset, same as LOGO_SVG.
export const E1_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="25 11 37 43" aria-hidden="true" focusable="false"><path d="M32.8689 46.707V18.1296H50.3534V21.3593H36.5264V30.678H49.4089V33.9078H36.5264V43.4944H50.5251V46.7241L32.8689 46.707Z" fill="#ffffff"/><path d="M60.0076 28.478V47.4271H57.6112V30.7084H57.4853L52.8871 34.1035V31.5178L57.0255 28.478H60.0076Z" fill="#51c878"/><path d="M58.3897 49.1578V50.1742C58.3892 50.3807 58.3066 50.5785 58.16 50.7245C58.0134 50.8705 57.8147 50.9527 57.6074 50.9532H28.8335C28.6262 50.9527 28.4276 50.8705 28.281 50.7245C28.1344 50.5785 28.0518 50.3807 28.0513 50.1742V14.8258C28.0518 14.6193 28.1344 14.4215 28.281 14.2755C28.4276 14.1295 28.6262 14.0473 28.8335 14.0468H57.6074C57.8147 14.0473 58.0134 14.1295 58.16 14.2755C58.3066 14.4215 58.3892 14.6193 58.3897 14.8258V26.7017H59.4352V14.8258C59.4347 14.3427 59.2422 13.8794 58.8997 13.5373C58.5572 13.1952 58.0926 13.002 57.6074 13H28.8335C28.3474 13.0005 27.8813 13.193 27.5376 13.5353C27.1938 13.8776 27.0005 14.3417 27 14.8258V50.1742C27.0005 50.6583 27.1938 51.1224 27.5376 51.4647C27.8813 51.807 28.3474 51.9995 28.8335 52H57.6074C58.0932 51.999 58.5588 51.8063 58.9021 51.464C59.2455 51.1218 59.4386 50.658 59.4391 50.1742V49.1578H58.3897Z" fill="#ffffff"/></svg>`;

// Send arrow icon (up-right arrow) for the chat input button
export const SEND_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>`;

// X close icon for the drawer header
export const CLOSE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

// Exclamation icon for the inline message-error retry button
export const ERROR_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="6" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
