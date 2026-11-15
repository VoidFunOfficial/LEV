// MapLibre runs its tile parsing in a module worker. The Next app serves the worker
// file as an asset; the DSH bundle carries its source and starts it from a Blob URL.
declare const __LEARNEV_MAP_WORKER__: string;

let url: string | undefined;

export function mapWorkerUrl() {
  url ??= URL.createObjectURL(new Blob([__LEARNEV_MAP_WORKER__], { type: "text/javascript" }));
  return url;
}
