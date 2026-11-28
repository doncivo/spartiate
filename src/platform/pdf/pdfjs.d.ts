// IMPORT-0303 : le build legacy de pdfjs-dist n'a pas de déclaration propre à `pdf.min.mjs` ; il réexporte l'API typée du paquet.
declare module 'pdfjs-dist/legacy/build/pdf.min.mjs' {
  export * from 'pdfjs-dist';
}
declare module 'pdfjs-dist/legacy/build/pdf.worker.min.mjs' {
  export const WorkerMessageHandler: unknown;
}
